import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Plugin, ViteDevServer } from 'vite';

interface ScannedTrack {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  metadata: {
    title: string;
    artist: string;
    album: string;
    lengthSeconds: number;
    offsetMs: number;
  };
  status: 'synced' | 'unsynced' | 'missing';
  source: 'companion_lrc' | 'embedded' | 'both' | 'none';
  rawLyrics: string;
  hasCompanionLrc: boolean;
  companionLrcPath: string | null;
}

let cachedLibrary: ScannedTrack[] | null = null;
let lastScanTime = 0;

/**
 * Read MUSIC_DIR from .env / .env.local if present
 */
function readEnvMusicDir(): string | null {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const full = path.resolve(process.cwd(), file);
    if (fs.existsSync(full)) {
      try {
        const content = fs.readFileSync(full, 'utf-8');
        const match = content.match(/^\s*MUSIC_DIR\s*=\s*(["']?)(.*?)\1\s*$/m);
        if (match && match[2].trim()) {
          return match[2].trim();
        }
      } catch {}
    }
  }
  return null;
}

/**
 * Resolve the initial music directory across different machines/OS environments
 */
export function getInitialMusicDirectory(): string {
  // 1. Check .env or process.env
  const envDir = readEnvMusicDir() || process.env.MUSIC_DIR;
  if (envDir && envDir.trim()) {
    return path.resolve(envDir.trim());
  }

  // 2. This device's primary library D:\Music
  if (fs.existsSync('D:\\Music')) {
    return 'D:\\Music';
  }

  // 3. User standard Home Music directory (~/Music)
  const homeMusic = path.join(os.homedir(), 'Music');
  if (fs.existsSync(homeMusic)) {
    return homeMusic;
  }

  // 4. Local repo ./music folder
  const localMusic = path.resolve(process.cwd(), 'music');
  if (fs.existsSync(localMusic)) {
    return localMusic;
  }

  // Default fallback for this device
  return 'D:\\Music';
}

let activeMusicDirectory = getInitialMusicDirectory();

/**
 * Extract duration from FLAC STREAMINFO header without external dependencies
 */
function getFlacDuration(filePath: string): number {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(42);
    fs.readSync(fd, buf, 0, 42, 0);
    fs.closeSync(fd);

    if (buf.toString('utf-8', 0, 4) !== 'fLaC') return 0;

    const sr = (buf[18] << 12) | (buf[19] << 4) | (buf[20] >> 4);
    const hi = buf[21] & 0x0f;
    const lo = buf[22] * (1 << 24) + (buf[23] << 16) + (buf[24] << 8) + buf[25];
    const totalSamples = hi * 4294967296 + lo;
    return sr > 0 ? Math.round((totalSamples / sr) * 100) / 100 : 0;
  } catch {
    return 0;
  }
}

/**
 * Parse Vorbis comments from FLAC file
 */
function parseFlacComments(filePath: string): Record<string, string> {
  const comments: Record<string, string> = {};
  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(4);
    fs.readSync(fd, header, 0, 4, 0);
    if (header.toString('utf-8') !== 'fLaC') {
      fs.closeSync(fd);
      return comments;
    }

    let offset = 4;
    let isLast = false;

    while (!isLast) {
      const blockHeader = Buffer.alloc(4);
      const bytesRead = fs.readSync(fd, blockHeader, 0, 4, offset);
      if (bytesRead < 4) break;

      isLast = (blockHeader[0] & 0x80) !== 0;
      const blockType = blockHeader[0] & 0x7f;
      const length = (blockHeader[1] << 16) | (blockHeader[2] << 8) | blockHeader[3];
      offset += 4;

      if (blockType === 4) {
        // VORBIS_COMMENT
        const commentData = Buffer.alloc(length);
        fs.readSync(fd, commentData, 0, length, offset);

        let pos = 0;
        const vendorLength = commentData.readUInt32LE(pos);
        pos += 4 + vendorLength;

        if (pos + 4 <= length) {
          const userCommentCount = commentData.readUInt32LE(pos);
          pos += 4;

          for (let i = 0; i < userCommentCount && pos + 4 <= length; i++) {
            const commentLen = commentData.readUInt32LE(pos);
            pos += 4;
            if (pos + commentLen > length) break;
            const commentStr = commentData.toString('utf-8', pos, pos + commentLen);
            pos += commentLen;

            const eqIdx = commentStr.indexOf('=');
            if (eqIdx !== -1) {
              const key = commentStr.slice(0, eqIdx).toUpperCase();
              const val = commentStr.slice(eqIdx + 1);
              if (!comments[key]) {
                comments[key] = val;
              } else {
                comments[key] += '\n' + val;
              }
            }
          }
        }
        break;
      }

      offset += length;
    }

    fs.closeSync(fd);
  } catch (_) {
    // Ignore read errors
  }
  return comments;
}

/**
 * Check if lyrics text contains sync timestamps [mm:ss.xx]
 */
function hasSyncTimestamps(text: string): boolean {
  if (!text) return false;
  return /\[\d{1,3}:\d{2}(?:\.\d{1,3})?\]|<\d{1,3}:\d{2}(?:\.\d{1,3})?>/.test(text);
}

/**
 * Scan configured music directory recursively
 */
export function scanMusicFolder(baseDir = activeMusicDirectory): ScannedTrack[] {
  const tracks: ScannedTrack[] = [];
  if (!fs.existsSync(baseDir)) return tracks;

  let counter = 0;

  function recurse(currentDir: string) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        recurse(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.flac', '.mp3', '.ogg', '.wav', '.m4a'].includes(ext)) {
          const baseName = path.basename(entry.name, ext);
          const stat = fs.statSync(fullPath);

          // 1. Companion .lrc
          const lrcPath = path.join(currentDir, baseName + '.lrc');
          let companionLrc: string | null = null;
          let hasCompanion = false;
          if (fs.existsSync(lrcPath)) {
            try {
              companionLrc = fs.readFileSync(lrcPath, 'utf-8');
              hasCompanion = true;
            } catch (_) {}
          }

          // 2. Embedded metadata & lyrics
          let tags: Record<string, string> = {};
          let embeddedLyrics: string | null = null;
          let duration = 0;

          if (ext === '.flac') {
            tags = parseFlacComments(fullPath);
            embeddedLyrics =
              tags['LYRICS'] ||
              tags['UNSYNCEDLYRICS'] ||
              tags['UNSYNCED LYRICS'] ||
              tags['SYNCEDLYRICS'] ||
              tags['SYNCED LYRICS'] ||
              null;
            duration = getFlacDuration(fullPath);
          }

          // Extract clean lyric lines ignoring metadata tags
          const extractLyricLines = (text: string | null): string[] => {
            if (!text) return [];
            return text
              .split(/\r?\n/)
              .map(line => line.trim())
              .filter(line => {
                if (!line) return false;
                if (/^\[[a-zA-Z]{1,15}:.*\]$/i.test(line)) return false;
                return true;
              });
          };

          const companionLines = extractLyricLines(companionLrc);
          const embeddedLines = extractLyricLines(embeddedLyrics);

          let rawLyrics = '';
          let source: ScannedTrack['source'] = 'none';

          if (companionLines.length > 0 && embeddedLines.length > 0) {
            source = 'both';
            rawLyrics = companionLrc || '';
          } else if (companionLines.length > 0) {
            source = 'companion_lrc';
            rawLyrics = companionLrc || '';
          } else if (embeddedLines.length > 0) {
            source = 'embedded';
            rawLyrics = embeddedLyrics || '';
          }

          const activeLines = companionLines.length > 0 ? companionLines : embeddedLines;

          let status: ScannedTrack['status'] = 'missing';
          if (activeLines.length > 0) {
            const timestampedCount = activeLines.filter(l => hasSyncTimestamps(l)).length;
            if (timestampedCount > 0) {
              status = 'synced';
            } else {
              status = 'unsynced';
            }
          }

          // Clean title & artist
          let title = tags['TITLE'] || baseName;
          // Strip prefix track number like "1-aespa-Drama-52IXO0" if title is fallback
          if (!tags['TITLE']) {
            title = baseName.replace(/^\d+[-_]/, '').replace(/[-_][A-Z0-9]{6}$/, '').replace(/-/g, ' ');
          }
          const artist = tags['ARTIST'] || path.basename(path.dirname(fullPath));
          const album = tags['ALBUM'] || path.basename(currentDir);

          counter++;
          tracks.push({
            id: `track-${counter}-${baseName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            filePath: fullPath,
            fileName: entry.name,
            fileSize: stat.size,
            fileType: ext === '.flac' ? 'audio/flac' : ext === '.mp3' ? 'audio/mpeg' : 'audio/octet-stream',
            metadata: {
              title,
              artist,
              album,
              lengthSeconds: duration,
              offsetMs: 0,
            },
            status,
            source,
            rawLyrics,
            hasCompanionLrc: hasCompanion,
            companionLrcPath: hasCompanion ? lrcPath : null,
          });
        }
      }
    }
  }

  recurse(baseDir);
  return tracks;
}

/**
 * Vite Plugin providing Music Library API and Streaming
 */
export function localMusicPlugin(): Plugin {
  return {
    name: 'vite-plugin-local-music',
    configureServer(server: ViteDevServer) {
      // 0. GET & POST /api/music-directory
      server.middlewares.use('/api/music-directory', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const dirPath = data?.dirPath?.trim();
              if (!dirPath) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Directory path is required' }));
                return;
              }

              const resolved = path.resolve(dirPath);
              if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: `Directory does not exist: ${resolved}`, path: resolved }));
                return;
              }

              activeMusicDirectory = resolved;
              cachedLibrary = scanMusicFolder(activeMusicDirectory);
              lastScanTime = Date.now();

              const summary = {
                total: cachedLibrary.length,
                synced: cachedLibrary.filter(t => t.status === 'synced').length,
                unsynced: cachedLibrary.filter(t => t.status === 'unsynced').length,
                missing: cachedLibrary.filter(t => t.status === 'missing').length,
              };

              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: true,
                  currentDir: activeMusicDirectory,
                  summary,
                  tracks: cachedLibrary,
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err?.message || 'Error updating directory' }));
            }
          });
          return;
        }

        // GET /api/music-directory
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            currentDir: activeMusicDirectory,
            exists: fs.existsSync(activeMusicDirectory),
            defaultDir: getInitialMusicDirectory(),
          })
        );
      });

      // 1. GET /api/music-library
      server.middlewares.use('/api/music-library', (req, res) => {
        const parsedUrl = new URL(req.url || '', 'http://localhost');
        const forceRefresh = parsedUrl.searchParams.get('refresh') === 'true';
        const customDir = parsedUrl.searchParams.get('dir');

        if (customDir && fs.existsSync(customDir) && fs.statSync(customDir).isDirectory()) {
          activeMusicDirectory = path.resolve(customDir);
          cachedLibrary = null;
        }

        const dirExists = fs.existsSync(activeMusicDirectory);
        if (!dirExists) {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              summary: { total: 0, synced: 0, unsynced: 0, missing: 0 },
              tracks: [],
              currentDir: activeMusicDirectory,
              dirExists: false,
            })
          );
          return;
        }

        const now = Date.now();
        // Cache for 10 seconds to avoid unnecessary disk re-scans unless forced
        if (!cachedLibrary || forceRefresh || now - lastScanTime > 10000) {
          cachedLibrary = scanMusicFolder(activeMusicDirectory);
          lastScanTime = now;
        }

        const summary = {
          total: cachedLibrary.length,
          synced: cachedLibrary.filter(t => t.status === 'synced').length,
          unsynced: cachedLibrary.filter(t => t.status === 'unsynced').length,
          missing: cachedLibrary.filter(t => t.status === 'missing').length,
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(
          JSON.stringify({
            summary,
            tracks: cachedLibrary,
            currentDir: activeMusicDirectory,
            dirExists: true,
          })
        );
      });

      // 2. GET /api/audio-stream?path=...
      server.middlewares.use('/api/audio-stream', (req, res) => {
        try {
          const parsedUrl = new URL(req.url || '', 'http://localhost');
          const filePath = parsedUrl.searchParams.get('path');

          if (!filePath || !fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end('File not found');
            return;
          }

          const stat = fs.statSync(filePath);
          const fileSize = stat.size;
          const range = req.headers.range;
          const ext = path.extname(filePath).toLowerCase();
          const contentType = ext === '.flac' ? 'audio/flac' : ext === '.mp3' ? 'audio/mpeg' : 'audio/octet-stream';

          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = end - start + 1;

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': contentType,
            });

            const stream = fs.createReadStream(filePath, { start, end });
            stream.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Content-Type': contentType,
              'Accept-Ranges': 'bytes',
            });
            fs.createReadStream(filePath).pipe(res);
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(err?.message || 'Error streaming audio');
        }
      });

      // 3. POST /api/save-lrc
      server.middlewares.use('/api/save-lrc', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { filePath, lrcContent } = data;

            if (!filePath || !lrcContent) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing filePath or lrcContent' }));
              return;
            }

            const ext = path.extname(filePath);
            const targetLrcPath = filePath.replace(new RegExp(`\\${ext}$`, 'i'), '.lrc');

            fs.writeFileSync(targetLrcPath, lrcContent, 'utf-8');

            // Invalidate cache
            cachedLibrary = null;

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, targetPath: targetLrcPath }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err?.message || 'Failed to save LRC' }));
          }
        });
      });
    },
  };
}
