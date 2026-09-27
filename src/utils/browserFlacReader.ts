/**
 * browserFlacReader.ts — Client-Side FLAC Metadata & Vorbis Comment Extractor
 * Reads FLAC headers and Vorbis tags directly in the browser via Web API ArrayBuffer
 */

export interface FlacMetadataResult {
  duration: number;
  tags: Record<string, string>;
  rawLyrics: string | null;
}

/**
 * Parse FLAC duration and Vorbis comments from a browser File or Blob
 */
export async function parseFlacFileInBrowser(file: Blob): Promise<FlacMetadataResult> {
  const result: FlacMetadataResult = {
    duration: 0,
    tags: {},
    rawLyrics: null,
  };

  try {
    // Read up to 4MB which safely covers FLAC metadata blocks and embedded artwork
    const headerBlob = file.slice(0, Math.min(file.size, 4194304));
    const arrayBuffer = await headerBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Check FLAC signature: 'fLaC' (0x66 0x4C 0x61 0x43)
    if (
      bytes.length < 4 ||
      bytes[0] !== 0x66 ||
      bytes[1] !== 0x4c ||
      bytes[2] !== 0x61 ||
      bytes[3] !== 0x43
    ) {
      return result;
    }

    let offset = 4;
    let isLast = false;

    while (!isLast && offset + 4 <= bytes.length) {
      const headerByte0 = bytes[offset];
      isLast = (headerByte0 & 0x80) !== 0;
      const blockType = headerByte0 & 0x7f;
      const length =
        (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 4;

      if (offset + length > bytes.length && !isLast) {
        // Exceeded current slice
        break;
      }

      // Block 0: STREAMINFO (contains sample rate and total samples)
      if (blockType === 0 && length >= 34) {
        const streamInfo = bytes.subarray(offset, offset + length);
        const sr = (streamInfo[10] << 12) | (streamInfo[11] << 4) | (streamInfo[12] >> 4);
        const hi = streamInfo[13] & 0x0f;
        const lo =
          streamInfo[14] * 16777216 +
          (streamInfo[15] << 16) +
          (streamInfo[16] << 8) +
          streamInfo[17];
        const totalSamples = hi * 4294967296 + lo;
        if (sr > 0) {
          result.duration = Math.round((totalSamples / sr) * 100) / 100;
        }
      }

      // Block 4: VORBIS_COMMENT
      if (blockType === 4 && offset + length <= bytes.length) {
        try {
          const view = new DataView(arrayBuffer, offset, length);
          let p = 0;

          // Vendor string length (little-endian uint32)
          if (p + 4 > length) break;
          const vendorLen = view.getUint32(p, true);
          p += 4 + vendorLen;

          // User comment list length (little-endian uint32)
          if (p + 4 <= length) {
            const commentCount = view.getUint32(p, true);
            p += 4;

            const decoder = new TextDecoder('utf-8');

            for (let c = 0; c < commentCount && p + 4 <= length; c++) {
              const strLen = view.getUint32(p, true);
              p += 4;
              if (p + strLen > length) break;

              const commentStr = decoder.decode(bytes.subarray(offset + p, offset + p + strLen));
              p += strLen;

              const eqIdx = commentStr.indexOf('=');
              if (eqIdx !== -1) {
                const key = commentStr.slice(0, eqIdx).toUpperCase().trim();
                const value = commentStr.slice(eqIdx + 1).trim();
                result.tags[key] = value;
              }
            }
          }
        } catch (_) {}
      }

      offset += length;
    }

    // Check for lyrics in Vorbis comments
    result.rawLyrics =
      result.tags['LYRICS'] ||
      result.tags['UNSYNCEDLYRICS'] ||
      result.tags['UNSYNCED LYRICS'] ||
      result.tags['SYNCEDLYRICS'] ||
      result.tags['SYNCED LYRICS'] ||
      null;

    return result;
  } catch {
    return result;
  }
}
