/**
 * Lyrics Studio Store — Pinia Global State
 *
 * Manages:
 * - Track library (census)
 * - Active track selection
 * - Playback state
 * - Line & word stamping with latency compensation
 * - Undo stack
 * - Search & filter
 * - Demo track preloading
 */

import { defineStore } from 'pinia';
import type {
  AudioTrack,
  LyricLine,
  StudioPlaybackState,
  TrackSyncStatus,
  UndoEntry,
} from '@/types';
import { parseRawLyricsToLines, serializeToFoobarLRC } from '@/utils/lrcEngine';
import { formatSecondsToLRC, formatSecondsToWordTag } from '@/utils/timeFormat';

let trackIdCounter = 0;
function generateTrackId(): string {
  return `track-${++trackIdCounter}-${Date.now().toString(36)}`;
}

export const useLyricsStudioStore = defineStore('lyricsStudio', {
  state: () => ({
    tracks: [] as AudioTrack[],
    activeTrackId: '' as string,
    activeMusicDir: '' as string,
    dirExists: true as boolean,
    isScanning: false,
    librarySummary: {
      total: 0,
      synced: 0,
      unsynced: 0,
      missing: 0,
    },
    playback: {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1.0,
      latencyCompensationMs: -120,
      activeLineIndex: 0,
      autoScrollLocked: true,
      stampingMode: 'line',
      volume: 0.85,
      isMuted: false,
    } as StudioPlaybackState,
    undoStack: [] as UndoEntry[],
    searchQuery: '',
    statusFilter: 'all' as 'all' | 'unsynced' | 'synced' | 'missing',
    toastMessage: '' as string,
    toastVisible: false,
  }),

  getters: {
    activeTrack: (state): AudioTrack | null =>
      state.tracks.find(t => t.id === state.activeTrackId) || null,

    filteredTracks: (state): AudioTrack[] => {
      return state.tracks.filter(t => {
        const q = state.searchQuery.toLowerCase();
        const matchesSearch =
          t.metadata.title.toLowerCase().includes(q) ||
          t.metadata.artist.toLowerCase().includes(q) ||
          t.fileName.toLowerCase().includes(q);
        const matchesStatus =
          state.statusFilter === 'all' ? true : t.status === state.statusFilter;
        return matchesSearch && matchesStatus;
      });
    },

    censusStats: (state) => ({
      total: state.tracks.length,
      unsynced: state.tracks.filter(t => t.status === 'unsynced').length,
      synced: state.tracks.filter(t => t.status === 'synced').length,
      missing: state.tracks.filter(t => t.status === 'missing').length,
    }),

    activeLine(): LyricLine | null {
      const track = this.activeTrack;
      if (!track) return null;
      return track.lyrics[this.playback.activeLineIndex] ?? null;
    },

    syncProgress(): number {
      const track = this.activeTrack;
      if (!track || track.lyrics.length === 0) return 0;
      const stamped = track.lyrics.filter(l => l.timestamp !== null).length;
      return Math.round((stamped / track.lyrics.length) * 100);
    },

    currentPlayingLineIndex(): number {
      const track = this.activeTrack;
      if (!track || track.lyrics.length === 0) return -1;
      const time = this.playback.currentTime;
      let activeIdx = -1;
      for (let i = 0; i < track.lyrics.length; i++) {
        const ts = track.lyrics[i].timestamp;
        if (ts !== null && ts <= time + 0.05) {
          activeIdx = i;
        } else if (ts !== null && ts > time + 0.05) {
          break;
        }
      }
      return activeIdx;
    },
  },

  actions: {
    // ── 1. Line Stamping ──
    stampActiveLine(): void {
      const track = this.activeTrack;
      if (!track) return;

      const line = track.lyrics[this.playback.activeLineIndex];
      if (!line) return;

      // Calculate latency-compensated time
      const compensatedTime = Math.max(
        0,
        this.playback.currentTime + this.playback.latencyCompensationMs / 1000,
      );

      if (this.playback.stampingMode === 'word' && line.wordStamps.length > 0 && !line.isInstrumentalGap) {
        // Word mode: stamp the next unstamped word
        this._stampActiveWord(track, line, compensatedTime);
      } else {
        // Line mode: stamp the entire line
        this._stampLine(track, line, compensatedTime);
      }
    },

    _stampLine(track: AudioTrack, line: LyricLine, time: number): void {
      // Record undo
      this.undoStack.push({
        type: 'line',
        lineIndex: this.playback.activeLineIndex,
        previousTime: line.timestamp,
        previousFormattedTime: line.formattedTime,
      });

      // Apply stamp
      line.timestamp = time;
      line.formattedTime = formatSecondsToLRC(time);

      // Advance to next line
      if (this.playback.activeLineIndex < track.lyrics.length - 1) {
        this.playback.activeLineIndex++;
      }

      // Check sync status
      this._updateTrackSyncStatus(track);
    },

    _stampActiveWord(track: AudioTrack, line: LyricLine, time: number): void {
      let wordIdx = line.activeWordIndex;
      let word = line.wordStamps[wordIdx];
      if (!word) return;

      // If current word was already singing (has startTime and no endTime),
      // pressing Space again closes this word and transitions to next word
      if (word.startTime !== null && (word.endTime === null || word.endTime === undefined)) {
        word.endTime = time;
        word.endFormattedTime = formatSecondsToWordTag(time);

        // Advance to next word
        if (wordIdx < line.wordStamps.length - 1) {
          line.activeWordIndex++;
          wordIdx = line.activeWordIndex;
          word = line.wordStamps[wordIdx];
        } else {
          // Last word of the line finished
          line.activeWordIndex = 0;
          if (this.playback.activeLineIndex < track.lyrics.length - 1) {
            this.playback.activeLineIndex++;
          }
          this._updateTrackSyncStatus(track);
          return;
        }
      }

      // If previous word had startTime and NO endTime, close it at current time
      if (wordIdx > 0) {
        const prevWord = line.wordStamps[wordIdx - 1];
        if (prevWord && prevWord.startTime !== null && (prevWord.endTime === null || prevWord.endTime === undefined)) {
          prevWord.endTime = time;
          prevWord.endFormattedTime = formatSecondsToWordTag(time);
        }
      }

      // Record undo
      this.undoStack.push({
        type: 'word',
        lineIndex: this.playback.activeLineIndex,
        wordIndex: wordIdx,
        previousTime: word.startTime,
        previousFormattedTime: word.formattedTime,
        previousActiveWordIndex: wordIdx,
        previousActiveLineIndex: this.playback.activeLineIndex,
      });

      // Stamp word
      word.startTime = time;
      word.formattedTime = formatSecondsToWordTag(time);
      word.endTime = null;
      word.endFormattedTime = '';

      // If this is the first word, also stamp the line itself
      if (wordIdx === 0) {
        line.timestamp = time;
        line.formattedTime = formatSecondsToLRC(time);
      }

      this._updateTrackSyncStatus(track);
    },

    // ── 1b. End Active Word Timestamp (Ctrl+Space or Alt+Space) ──
    endActiveWordTimestamp(): void {
      const track = this.activeTrack;
      if (!track) return;

      const compensatedTime = Math.max(
        0,
        this.playback.currentTime + this.playback.latencyCompensationMs / 1000,
      );

      const line = track.lyrics[this.playback.activeLineIndex];
      if (!line || line.isInstrumentalGap || line.wordStamps.length === 0) return;

      let targetWordIdx = line.activeWordIndex;
      let word = line.wordStamps[targetWordIdx];

      // If current word hasn't started yet, check if the previous word needs ending
      if (!word || word.startTime === null) {
        if (targetWordIdx > 0 && line.wordStamps[targetWordIdx - 1]?.startTime !== null) {
          targetWordIdx = targetWordIdx - 1;
          word = line.wordStamps[targetWordIdx];
        } else if (this.playback.activeLineIndex > 0) {
          // Check previous line's last word
          const prevLine = track.lyrics[this.playback.activeLineIndex - 1];
          if (prevLine && prevLine.wordStamps.length > 0) {
            const lastWord = prevLine.wordStamps[prevLine.wordStamps.length - 1];
            if (lastWord && lastWord.startTime !== null && (lastWord.endTime === null || lastWord.endTime === undefined)) {
              this.undoStack.push({
                type: 'word-end',
                lineIndex: this.playback.activeLineIndex - 1,
                wordIndex: prevLine.wordStamps.length - 1,
                previousTime: lastWord.endTime ?? null,
                previousFormattedTime: lastWord.endFormattedTime ?? '',
                previousActiveWordIndex: line.activeWordIndex,
                previousActiveLineIndex: this.playback.activeLineIndex,
              });
              lastWord.endTime = compensatedTime;
              lastWord.endFormattedTime = formatSecondsToWordTag(compensatedTime);
              this.showToast(`Ended word "${lastWord.word}" at ${lastWord.endFormattedTime}`);
              return;
            }
          }
          this.showToast('No active word to end');
          return;
        } else {
          this.showToast('No active word to end');
          return;
        }
      }

      // Record undo
      this.undoStack.push({
        type: 'word-end',
        lineIndex: this.playback.activeLineIndex,
        wordIndex: targetWordIdx,
        previousTime: word.endTime ?? null,
        previousFormattedTime: word.endFormattedTime ?? '',
        previousActiveWordIndex: line.activeWordIndex,
        previousActiveLineIndex: this.playback.activeLineIndex,
      });

      // Apply end time
      word.endTime = compensatedTime;
      word.endFormattedTime = formatSecondsToWordTag(compensatedTime);

      // Advance word index if we were on the word that was just ended
      if (line.activeWordIndex === targetWordIdx) {
        if (line.activeWordIndex < line.wordStamps.length - 1) {
          line.activeWordIndex++;
        } else {
          // All words in line finished — advance to next line
          line.activeWordIndex = 0;
          if (this.playback.activeLineIndex < track.lyrics.length - 1) {
            this.playback.activeLineIndex++;
          }
        }
      }

      this._updateTrackSyncStatus(track);
      this.showToast(`Ended word "${word.word}" at ${word.endFormattedTime}`);
    },

    // ── 2. Undo ──
    undoLastStamp(): { shouldRewind: boolean } {
      const track = this.activeTrack;
      if (!track) return { shouldRewind: false };

      const entry = this.undoStack.pop();
      if (!entry) return { shouldRewind: false };

      if (entry.type === 'word-end' && entry.wordIndex !== undefined) {
        const line = track.lyrics[entry.lineIndex];
        if (line) {
          const word = line.wordStamps[entry.wordIndex];
          if (word) {
            word.endTime = entry.previousTime;
            word.endFormattedTime = entry.previousFormattedTime;
          }
          if (entry.previousActiveWordIndex !== undefined) {
            line.activeWordIndex = entry.previousActiveWordIndex;
          }
          if (entry.previousActiveLineIndex !== undefined) {
            this.playback.activeLineIndex = entry.previousActiveLineIndex;
          }
        }
      } else if (entry.type === 'word' && entry.wordIndex !== undefined) {
        const line = track.lyrics[entry.lineIndex];
        if (line) {
          const word = line.wordStamps[entry.wordIndex];
          if (word) {
            word.startTime = entry.previousTime;
            word.formattedTime = entry.previousFormattedTime;
            word.endTime = null;
            word.endFormattedTime = '';
          }
          line.activeWordIndex = entry.wordIndex;
          this.playback.activeLineIndex = entry.lineIndex;

          // If undoing the first word, also undo the line timestamp
          if (entry.wordIndex === 0) {
            line.timestamp = entry.previousTime;
            line.formattedTime = entry.previousTime !== null
              ? formatSecondsToLRC(entry.previousTime)
              : '[--:--.--]';
          }
        }
      } else {
        const line = track.lyrics[entry.lineIndex];
        if (line) {
          line.timestamp = entry.previousTime;
          line.formattedTime = entry.previousTime !== null
            ? formatSecondsToLRC(entry.previousTime)
            : '[--:--.--]';
        }
        this.playback.activeLineIndex = entry.lineIndex;
      }

      this._updateTrackSyncStatus(track);
      return { shouldRewind: true };
    },

    // ── 3. Instrumental Gap ──
    stampInstrumentalGap(): void {
      const track = this.activeTrack;
      if (!track) return;

      const line = track.lyrics[this.playback.activeLineIndex];
      if (!line) return;

      const compensatedTime = Math.max(
        0,
        this.playback.currentTime + this.playback.latencyCompensationMs / 1000,
      );

      // Record undo
      this.undoStack.push({
        type: 'line',
        lineIndex: this.playback.activeLineIndex,
        previousTime: line.timestamp,
        previousFormattedTime: line.formattedTime,
      });

      // Stamp as instrumental gap
      line.timestamp = compensatedTime;
      line.formattedTime = formatSecondsToLRC(compensatedTime);
      line.isInstrumentalGap = true;
      line.rawText = '';

      // Advance
      if (this.playback.activeLineIndex < track.lyrics.length - 1) {
        this.playback.activeLineIndex++;
      }

      this._updateTrackSyncStatus(track);
    },

    // ── 4. Line Nudging ──
    nudgeLine(lineIndex: number, deltaMs: number): void {
      const track = this.activeTrack;
      if (!track) return;

      const line = track.lyrics[lineIndex];
      if (!line || line.timestamp === null) return;

      line.timestamp = Math.max(0, line.timestamp + deltaMs / 1000);
      line.formattedTime = formatSecondsToLRC(line.timestamp);

      // Also nudge word timestamps if they exist
      for (const word of line.wordStamps) {
        if (word.startTime !== null) {
          word.startTime = Math.max(0, word.startTime + deltaMs / 1000);
          word.formattedTime = formatSecondsToWordTag(word.startTime);
        }
        if (word.endTime !== null && word.endTime !== undefined) {
          word.endTime = Math.max(0, word.endTime + deltaMs / 1000);
          word.endFormattedTime = formatSecondsToWordTag(word.endTime);
        }
      }
    },

    // ── 5. Global Track Offset ──
    nudgeGlobalTrack(deltaMs: number): void {
      const track = this.activeTrack;
      if (!track) return;

      for (const line of track.lyrics) {
        if (line.timestamp !== null) {
          line.timestamp = Math.max(0, line.timestamp + deltaMs / 1000);
          line.formattedTime = formatSecondsToLRC(line.timestamp);
        }
        for (const word of line.wordStamps) {
          if (word.startTime !== null) {
            word.startTime = Math.max(0, word.startTime + deltaMs / 1000);
            word.formattedTime = formatSecondsToWordTag(word.startTime);
          }
          if (word.endTime !== null && word.endTime !== undefined) {
            word.endTime = Math.max(0, word.endTime + deltaMs / 1000);
            word.endFormattedTime = formatSecondsToWordTag(word.endTime);
          }
        }
      }
    },

    // ── 6. Reset Line ──
    resetLineTimestamp(lineIndex: number): void {
      const track = this.activeTrack;
      if (!track) return;

      const line = track.lyrics[lineIndex];
      if (!line) return;

      line.timestamp = null;
      line.formattedTime = '[--:--.--]';
      line.isInstrumentalGap = false;

      for (const word of line.wordStamps) {
        word.startTime = null;
        word.formattedTime = '';
        word.endTime = null;
        word.endFormattedTime = '';
      }
      line.activeWordIndex = 0;

      this._updateTrackSyncStatus(track);
    },

    // ── 7. Track Status Update ──
    _updateTrackSyncStatus(track: AudioTrack): void {
      const totalLines = track.lyrics.filter(l => l.rawText.trim() !== '' || l.isInstrumentalGap).length;
      const stampedLines = track.lyrics.filter(l => l.timestamp !== null).length;

      if (stampedLines === 0) {
        track.status = 'unsynced';
      } else if (stampedLines >= totalLines && totalLines > 0) {
        track.status = 'synced';
      } else {
        track.status = 'unsynced';
      }
    },

    // ── 8. Local Music Library Integration ──
    async fetchLocalLibrary(forceRefresh = false): Promise<void> {
      this.isScanning = true;
      try {
        const url = forceRefresh ? '/api/music-library?refresh=true' : '/api/music-library';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        this.activeMusicDir = data.currentDir || '';
        this.dirExists = data.dirExists ?? true;
        this.librarySummary = data.summary;

        // Map scanned tracks
        this.tracks = data.tracks.map((t: any) => {
          const lines = parseRawLyricsToLines(t.rawLyrics || '');
          return {
            id: t.id,
            filePath: t.filePath,
            fileName: t.fileName,
            fileSize: t.fileSize,
            fileType: t.fileType,
            fileBlobUrl: `/api/audio-stream?path=${encodeURIComponent(t.filePath)}`,
            fileRef: null,
            metadata: {
              title: t.metadata.title,
              artist: t.metadata.artist,
              album: t.metadata.album,
              lengthSeconds: t.metadata.lengthSeconds,
              offsetMs: 0,
            },
            status: t.status as TrackSyncStatus,
            lyrics: lines,
            originalRawLyrics: t.rawLyrics || '',
            hasEmbeddedLyrics: t.source === 'embedded' || t.source === 'both',
            hasCompanionLrc: t.hasCompanionLrc,
            companionLrcPath: t.companionLrcPath,
          };
        });

        // Select first track (prefer unsynced track that needs stamping)
        if (this.tracks.length > 0 && !this.activeTrackId) {
          const firstUnsynced = this.tracks.find(t => t.status === 'unsynced');
          this.selectTrack(firstUnsynced ? firstUnsynced.id : this.tracks[0].id);
        }

        if (this.dirExists) {
          this.showToast(
            `Scanned ${this.activeMusicDir}: ${data.summary.total} tracks (${data.summary.synced} synced, ${data.summary.unsynced} unsynced)`
          );
        } else {
          this.showToast(`Music directory not found: ${this.activeMusicDir}`);
        }
      } catch (err: any) {
        console.warn('Could not fetch local library from /api/music-library:', err);
      } finally {
        this.isScanning = false;
      }
    },

    async setMusicDirectory(newDir: string): Promise<boolean> {
      this.isScanning = true;
      try {
        const res = await fetch('/api/music-directory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirPath: newDir }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.showToast(data.error || 'Invalid music directory');
          return false;
        }

        this.activeMusicDir = data.currentDir;
        this.dirExists = true;
        this.librarySummary = data.summary;

        this.tracks = data.tracks.map((t: any) => {
          const lines = parseRawLyricsToLines(t.rawLyrics || '');
          return {
            id: t.id,
            filePath: t.filePath,
            fileName: t.fileName,
            fileSize: t.fileSize,
            fileType: t.fileType,
            fileBlobUrl: `/api/audio-stream?path=${encodeURIComponent(t.filePath)}`,
            fileRef: null,
            metadata: {
              title: t.metadata.title,
              artist: t.metadata.artist,
              album: t.metadata.album,
              lengthSeconds: t.metadata.lengthSeconds,
              offsetMs: 0,
            },
            status: t.status as TrackSyncStatus,
            lyrics: lines,
            originalRawLyrics: t.rawLyrics || '',
            hasEmbeddedLyrics: t.source === 'embedded' || t.source === 'both',
            hasCompanionLrc: t.hasCompanionLrc,
            companionLrcPath: t.companionLrcPath,
          };
        });

        if (this.tracks.length > 0) {
          const firstUnsynced = this.tracks.find(t => t.status === 'unsynced');
          this.selectTrack(firstUnsynced ? firstUnsynced.id : this.tracks[0].id);
        } else {
          this.activeTrackId = '';
        }

        this.showToast(`Music directory switched to ${data.currentDir} (${data.summary.total} tracks)`);
        return true;
      } catch (err: any) {
        this.showToast(`Failed to change directory: ${err.message}`);
        return false;
      } finally {
        this.isScanning = false;
      }
    },

    async saveLrcToDisk(notify = true): Promise<boolean> {
      const track = this.activeTrack;
      if (!track || !track.filePath) {
        if (notify) this.showToast('No active local track file path');
        return false;
      }

      try {
        const lrcContent = serializeToFoobarLRC(track);
        const res = await fetch('/api/save-lrc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: track.filePath,
            lrcContent,
          }),
        });

        if (!res.ok) throw new Error('Failed to save to disk');
        const data = await res.json();

        this._updateTrackSyncStatus(track);
        track.hasCompanionLrc = true;
        track.companionLrcPath = data.targetPath;

        if (notify) {
          const lrcName = track.fileName.replace(/\.[^.]+$/, '.lrc');
          this.showToast(`Saved .lrc next to ${lrcName}`);
        }
        return true;
      } catch (err: any) {
        if (notify) this.showToast(`Error saving .lrc: ${err.message}`);
        return false;
      }
    },

    loadDemoTracks(): void {
      this.fetchLocalLibrary();
    },

    // ── 9. File Import ──
    async handleFileImport(files: FileList | File[]): Promise<void> {
      const supportedTypes = [
        'audio/flac',
        'audio/mpeg',
        'audio/mp3',
        'audio/ogg',
        'audio/wav',
        'audio/wave',
        'audio/x-wav',
        'audio/x-flac',
      ];
      const supportedExtensions = ['.flac', '.mp3', '.ogg', '.wav'];

      for (const file of Array.from(files)) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        const isSupported =
          supportedTypes.includes(file.type) || supportedExtensions.includes(ext);

        if (!isSupported) continue;

        const blobUrl = URL.createObjectURL(file);

        // Determine file format label
        let fileType = ext.replace('.', '').toUpperCase();
        if (fileType === 'MP3') fileType = 'MP3';
        else if (fileType === 'FLAC') fileType = 'FLAC';
        else if (fileType === 'OGG') fileType = 'OGG';
        else if (fileType === 'WAV') fileType = 'WAV';

        // Get duration from audio element
        const audioDuration = await this._getAudioDuration(blobUrl);

        const track: AudioTrack = {
          id: generateTrackId(),
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || `audio/${ext.replace('.', '')}`,
          fileBlobUrl: blobUrl,
          fileRef: file,
          metadata: {
            title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            lengthSeconds: audioDuration,
            offsetMs: 0,
          },
          status: 'unsynced',
          lyrics: [],
          originalRawLyrics: '',
          hasEmbeddedLyrics: false,
        };

        this.tracks.push(track);

        // Auto-select if this is the first/only track
        if (this.tracks.length === 1 || !this.activeTrackId) {
          this.activeTrackId = track.id;
        }
      }
    },

    _getAudioDuration(blobUrl: string): Promise<number> {
      return new Promise(resolve => {
        const audio = new Audio();
        audio.src = blobUrl;
        audio.addEventListener('loadedmetadata', () => {
          resolve(audio.duration);
        });
        audio.addEventListener('error', () => {
          resolve(0);
        });
      });
    },

    // ── 10. Track Selection ──
    selectTrack(id: string): void {
      this.activeTrackId = id;
      this.playback.activeLineIndex = 0;
      this.playback.autoScrollLocked = true;
      this.undoStack = [];
    },

    // ── 11. Update Lyrics Text ──
    async updateTrackLyrics(rawText: string, autoSaveToDisk = true): Promise<void> {
      const track = this.activeTrack;
      if (!track) return;

      track.originalRawLyrics = rawText;
      track.lyrics = parseRawLyricsToLines(rawText);
      this._updateTrackSyncStatus(track);
      this.playback.activeLineIndex = 0;
      this.undoStack = [];

      // Auto-save to .lrc on disk if it's a local track
      if (autoSaveToDisk && track.filePath) {
        await this.saveLrcToDisk(false);
        const lrcName = track.fileName.replace(/\.[^.]+$/, '.lrc');
        this.showToast(`Saved ${track.lyrics.length} lines to ${lrcName}`);
      } else {
        this.showToast(`Loaded ${track.lyrics.length} lyric lines`);
      }
    },

    // ── 12. Reset All Timestamps (Re-sync) ──
    async resetAllTimestamps(): Promise<void> {
      const track = this.activeTrack;
      if (!track) return;

      for (const line of track.lyrics) {
        line.timestamp = null;
        line.formattedTime = '[--:--.--]';
        line.isInstrumentalGap = false;
        for (const word of line.wordStamps) {
          word.startTime = null;
          word.formattedTime = '';
        }
        line.activeWordIndex = 0;
      }

      this.playback.activeLineIndex = 0;
      this.undoStack = [];
      track.status = 'unsynced';

      // Save cleared timestamps to disk so the file stays in sync
      if (track.filePath) {
        await this.saveLrcToDisk(false);
        this.showToast('All timestamps cleared and updated on disk.');
      } else {
        this.showToast('All timestamps cleared. Ready to re-sync.');
      }
    },

    // ── 12. Toast ──
    showToast(message: string): void {
      this.toastMessage = message;
      this.toastVisible = true;
      setTimeout(() => {
        this.toastVisible = false;
      }, 2500);
    },
  },
});
