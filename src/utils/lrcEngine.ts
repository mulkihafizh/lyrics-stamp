/**
 * LRC Engine — foobar2000-compliant LRC serializer/parser
 *
 * Supports:
 * - Standard LRC: [mm:ss.xx] line text
 * - Enhanced LRC: [mm:ss.xx] <mm:ss.xx> word1 <mm:ss.xx> word2
 * - foobar2000 OpenLyrics / ESLyric format
 * - Vorbis LYRICS tag format
 * - UTF-8 no BOM, \n line endings
 */

import type { AudioTrack, LyricLine, WordStamp } from '@/types';
import {
  formatSecondsToLRC,
  formatSecondsToWordTag,
  formatSecondsToLength,
  parseLRCTimestamp,
  parseWordTimestamp,
} from './timeFormat';

let lineIdCounter = 0;

/**
 * Generate a unique line ID
 */
function generateLineId(): string {
  return `line-${++lineIdCounter}-${Date.now().toString(36)}`;
}

/**
 * Split a line of text into individual words, preserving meaningful tokens.
 */
function splitIntoWords(text: string): string[] {
  return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Parse raw lyrics text into structured LyricLine array.
 *
 * - Strips carriage returns
 * - Collapses 3+ consecutive empty lines into single paragraph dividers
 * - Detects existing [mm:ss.xx] timestamps
 * - Initializes word stamps for each line
 */
export function parseRawLyricsToLines(rawText: string): LyricLine[] {
  // Normalize line endings
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Collapse triple+ empty lines into double (paragraph separator)
  text = text.replace(/\n{3,}/g, '\n\n');

  // Trim trailing whitespace per line, but keep empty lines
  const rawLines = text.split('\n').map(l => l.trimEnd());

  const lines: LyricLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];

    // Skip LRC metadata tags like [ar:...], [ti:...], [al:...], [by:...], [re:...], [ve:...], [offset:...]
    if (/^\[(ar|al|ti|by|re|ve|offset|length):.*\]$/i.test(raw.trim())) {
      continue;
    }

    // Check for existing timestamp [mm:ss.xx] or [mm:ss] or [mm:ss.xxx]
    const timestampMatch = raw.match(/^\[(\d{1,3}:\d{2}(?:\.\d{1,3})?)\]\s*(.*)/);

    let timestamp: number | null = null;
    let formattedTime = '[--:--.--]';
    let lineText = raw;
    let isInstrumentalGap = false;

    if (timestampMatch) {
      timestamp = parseLRCTimestamp(`[${timestampMatch[1]}]`);
      formattedTime = formatSecondsToLRC(timestamp ?? 0);
      lineText = timestampMatch[2];

      // Empty text after timestamp = instrumental gap
      if (lineText.trim() === '') {
        isInstrumentalGap = true;
      }
    }

    // Parse word-level timestamps if present (Enhanced LRC)
    const words = splitIntoWords(lineText.replace(/<\d{1,3}:\d{2}\.\d{2,3}>/g, ''));
    const wordStamps: WordStamp[] = [];

    // Check for inline word timestamps
    const wordTagPattern = /<(\d{1,3}:\d{2}\.\d{2,3})>\s*([^<]*)/g;
    let wordMatch;
    const hasWordTags = lineText.includes('<') && /<\d{1,3}:\d{2}\.\d{2,3}>/.test(lineText);

    if (hasWordTags) {
      while ((wordMatch = wordTagPattern.exec(lineText)) !== null) {
        const wordTime = parseWordTimestamp(`<${wordMatch[1]}>`);
        const wordText = wordMatch[2].trim();
        if (wordText) {
          wordStamps.push({
            word: wordText,
            startTime: wordTime,
            endTime: null,
            formattedTime: wordTime !== null ? formatSecondsToWordTag(wordTime) : '',
            endFormattedTime: '',
          });
        } else if (wordStamps.length > 0 && wordTime !== null) {
          // A trailing tag with no text is the end timestamp for the preceding word
          const lastWord = wordStamps[wordStamps.length - 1];
          lastWord.endTime = wordTime;
          lastWord.endFormattedTime = formatSecondsToWordTag(wordTime);
        }
      }
    } else {
      // Initialize empty word stamps from plain text
      for (const word of words) {
        wordStamps.push({
          word,
          startTime: null,
          endTime: null,
          formattedTime: '',
          endFormattedTime: '',
        });
      }
    }

    lines.push({
      id: generateLineId(),
      lineIndex: i,
      rawText: isInstrumentalGap ? '' : lineText.replace(/<\d{1,3}:\d{2}\.\d{2,3}>/g, '').trim(),
      timestamp,
      formattedTime,
      isInstrumentalGap,
      wordStamps,
      activeWordIndex: 0,
    });
  }

  return lines;
}

/**
 * Serialize to standard foobar2000 OpenLyrics LRC format.
 *
 * Output:
 * [ti:Song Title]
 * [ar:Artist Name]
 * [al:Album Name]
 * [length:03:45]
 * [offset:0]
 *
 * [00:12.30]First line of the verse
 * [00:15.80]Second line with vocals
 * [00:22.00]
 * [00:35.10]Line after instrumental break
 */
export function serializeToFoobarLRC(track: AudioTrack): string {
  const header = [
    `[ti:${track.metadata.title}]`,
    `[ar:${track.metadata.artist}]`,
    `[al:${track.metadata.album}]`,
    `[length:${formatSecondsToLength(track.metadata.lengthSeconds)}]`,
    `[offset:${track.metadata.offsetMs}]`,
  ].join('\n');

  const body = track.lyrics
    .map(line => {
      if (line.isInstrumentalGap) {
        // Instrumental gap: timestamp with no text (clears foobar2000 display)
        return line.timestamp !== null ? formatSecondsToLRC(line.timestamp) : '';
      }
      if (line.timestamp !== null) {
        const ts = formatSecondsToLRC(line.timestamp);
        const sep = line.rawText.startsWith(' ') ? '' : ' ';
        return `${ts}${sep}${line.rawText}`;
      }
      // Unstamped line: keep rawText so uncompleted lyrics are safely preserved in the file
      return line.rawText;
    })
    .join('\n');

  return `${header}\n\n${body}\n`;
}

/**
 * Serialize to Enhanced LRC format with per-word timestamps.
 *
 * Output:
 * [00:12.30] <00:12.30> Hello <00:12.80> darkness <00:13.40> my <00:13.70> old <00:14.10> friend
 */
export function serializeToEnhancedLRC(track: AudioTrack): string {
  const header = [
    `[ti:${track.metadata.title}]`,
    `[ar:${track.metadata.artist}]`,
    `[al:${track.metadata.album}]`,
    `[length:${formatSecondsToLength(track.metadata.lengthSeconds)}]`,
    `[offset:${track.metadata.offsetMs}]`,
  ].join('\n');

  const body = track.lyrics
    .map(line => {
      if (line.isInstrumentalGap) {
        return line.timestamp !== null ? formatSecondsToLRC(line.timestamp) : '';
      }

      if (line.timestamp === null) {
        return line.rawText;
      }

      const lineTs = formatSecondsToLRC(line.timestamp);

      // Check if word stamps have timing data
      const hasWordTimings = line.wordStamps.some(w => w.startTime !== null);

      if (hasWordTimings) {
        const wordParts = line.wordStamps
          .map((w, wi) => {
            if (w.startTime !== null) {
              const startTag = formatSecondsToWordTag(w.startTime);
              const nextWord = line.wordStamps[wi + 1];
              // If this word has an explicit endTime stamped, and it's the last word or there's a pause before next word
              const hasGapOrEnd = w.endTime !== null && w.endTime !== undefined &&
                (!nextWord || nextWord.startTime === null || Math.abs(nextWord.startTime - w.endTime) > 0.05);

              if (hasGapOrEnd) {
                const endTag = formatSecondsToWordTag(w.endTime!);
                return `${startTag} ${w.word} ${endTag}`;
              }
              return `${startTag} ${w.word}`;
            }
            return w.word;
          })
          .join(' ');
        return `${lineTs} ${wordParts}`;
      }

      const sep = line.rawText.startsWith(' ') ? '' : ' ';
      return `${lineTs}${sep}${line.rawText}`;
    })
    .join('\n');

  return `${header}\n\n${body}\n`;
}

/**
 * Serialize to Vorbis LYRICS tag format.
 * Same content as LRC, but designed for embedding in FLAC metadata.
 * Pure UTF-8 without BOM.
 */
export function serializeToVorbisTag(track: AudioTrack): string {
  // Vorbis tag uses the same LRC format
  return serializeToFoobarLRC(track);
}

/**
 * Generate a safe filename for the LRC file based on track metadata.
 */
export function generateLRCFilename(track: AudioTrack, extension = 'lrc'): string {
  const rawBase = track.fileName.replace(/\.[^.]+$/, '');
  // Sanitize characters not allowed in filenames
  const safeBase = rawBase.replace(/[\\/:*?"<>|]/g, '_').trim() || 'lyrics';
  return `${safeBase}.${extension}`;
}

