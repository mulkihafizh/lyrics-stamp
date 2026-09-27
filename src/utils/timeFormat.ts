/**
 * Time Format Utilities
 * Bidirectional conversion between decimal seconds and [mm:ss.xx] LRC timestamps
 * Strict foobar2000 hundredths-of-a-second precision
 */

/**
 * Convert decimal seconds to LRC timestamp string.
 * @example formatSecondsToLRC(134.082) → "[02:14.08]"
 * @example formatSecondsToLRC(0) → "[00:00.00]"
 */
export function formatSecondsToLRC(seconds: number): string {
  if (seconds < 0) seconds = 0;

  const roundedHundredths = Math.round(seconds * 100);
  const minutes = Math.floor(roundedHundredths / 6000);
  const secs = Math.floor((roundedHundredths % 6000) / 100);
  const xx = roundedHundredths % 100;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const xxStr = String(xx).padStart(2, '0');

  return `[${mm}:${ss}.${xxStr}]`;
}

/**
 * Convert decimal seconds to enhanced LRC inline word timestamp.
 * @example formatSecondsToWordTag(134.082) → "<02:14.08>"
 */
export function formatSecondsToWordTag(seconds: number): string {
  if (seconds < 0) seconds = 0;

  const roundedHundredths = Math.round(seconds * 100);
  const minutes = Math.floor(roundedHundredths / 6000);
  const secs = Math.floor((roundedHundredths % 6000) / 100);
  const xx = roundedHundredths % 100;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const xxStr = String(xx).padStart(2, '0');

  return `<${mm}:${ss}.${xxStr}>`;
}

/**
 * Parse an LRC timestamp string back to decimal seconds.
 * Supports both [mm:ss.xx] and [mm:ss.xxx] formats.
 * @example parseLRCTimestamp("[02:14.08]") → 134.08
 * @returns decimal seconds or null if unparseable
 */
export function parseLRCTimestamp(timestampStr: string): number | null {
  // Match [mm:ss] or [mm:ss.x] or [mm:ss.xx] or [mm:ss.xxx]
  const match = timestampStr.match(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/);
  if (!match) return null;

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const fractional = match[3] || '0';

  const fraction = parseInt(fractional, 10) / Math.pow(10, fractional.length);

  return minutes * 60 + seconds + fraction;
}

/**
 * Parse an Enhanced LRC word timestamp <mm:ss.xx> back to decimal seconds.
 * @example parseWordTimestamp("<02:14.08>") → 134.08
 */
export function parseWordTimestamp(tag: string): number | null {
  const match = tag.match(/<(\d{1,3}):(\d{2})\.(\d{2,3})>/);
  if (!match) return null;

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const fractional = match[3];
  const fraction = parseInt(fractional, 10) / Math.pow(10, fractional.length);

  return minutes * 60 + seconds + fraction;
}

/**
 * Format seconds to human-readable display: "01:24.08"
 * (without brackets, for playback time readout)
 */
export function formatSecondsToDisplay(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) seconds = 0;

  const totalSeconds = Math.floor(seconds);
  const hundredths = Math.floor((seconds - totalSeconds) * 100);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const xx = String(hundredths).padStart(2, '0');

  return `${mm}:${ss}.${xx}`;
}

/**
 * Format total seconds to mm:ss for LRC [length:] header.
 * @example formatSecondsToLength(225) → "03:45"
 */
export function formatSecondsToLength(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
