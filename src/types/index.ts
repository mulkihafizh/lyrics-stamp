// ── Sync Status ──
export type TrackSyncStatus = 'unsynced' | 'synced' | 'missing';

// ── Stamping Mode ──
export type StampingMode = 'line' | 'word';

// ── Per-Word Timestamp (Enhanced LRC / Apple Music style) ──
export interface WordStamp {
  word: string;
  startTime: number | null;   // Float seconds, or null if unstamped
  endTime?: number | null;     // Float seconds when word singing ends, or null
  formattedTime: string;       // "<mm:ss.xx>" or ""
  endFormattedTime?: string;   // "<mm:ss.xx>" or ""
}

// ── Lyric Line ──
export interface LyricLine {
  id: string;
  lineIndex: number;
  rawText: string;
  timestamp: number | null;    // Float in seconds (e.g. 134.08), or null if unstamped
  formattedTime: string;       // Display string "[02:14.08]" or "[--:--.--]"
  isInstrumentalGap: boolean;
  wordStamps: WordStamp[];     // Per-word timestamps for Enhanced LRC mode
  activeWordIndex: number;     // Currently active word index in word-stamping mode
}

// ── Track Metadata ──
export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  lengthSeconds: number;
  offsetMs: number;
}

// ── Audio Track ──
export interface AudioTrack {
  id: string;
  filePath?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileBlobUrl: string | null;
  fileRef: File | null;
  metadata: TrackMetadata;
  status: TrackSyncStatus;
  lyrics: LyricLine[];
  originalRawLyrics: string;
  hasEmbeddedLyrics: boolean;
  hasCompanionLrc?: boolean;
  companionLrcPath?: string | null;
  fileHandle?: any;           // FileSystemFileHandle when opened via File System Access API
  dirHandle?: any;            // FileSystemDirectoryHandle of the parent folder
}

// ── Studio Playback State ──
export interface StudioPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;           // 0.70, 0.85, 1.0, 1.15, 1.25
  latencyCompensationMs: number;  // e.g. -120 ms
  activeLineIndex: number;
  autoScrollLocked: boolean;
  stampingMode: StampingMode;     // 'line' (default) or 'word'
  volume: number;                 // 0.0 to 1.0
  isMuted: boolean;
}

// ── Undo Entry ──
export interface UndoEntry {
  type: 'line' | 'word' | 'word-end';
  lineIndex: number;
  wordIndex?: number;
  previousTime: number | null;
  previousFormattedTime: string;
  previousActiveWordIndex?: number;
  previousActiveLineIndex?: number;
}

