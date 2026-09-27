/**
 * Procedural Audio Synthesizer
 *
 * Generates a 3-minute lo-fi ambient chord progression with rhythmic pulses
 * at 85 BPM using the Web Audio API. Converts AudioBuffer → WAV Blob.
 *
 * This ensures the studio works immediately without uploading files.
 */

const SAMPLE_RATE = 44100;
const BPM = 85;
const DURATION_SECONDS = 180; // 3 minutes
const BEAT_INTERVAL = 60 / BPM;

// Lo-fi chord progression (frequencies in Hz)
// Am → F → C → G — warm, pleasant, non-distracting
const CHORD_PROGRESSION = [
  [220.00, 261.63, 329.63],  // Am:  A3, C4, E4
  [174.61, 220.00, 261.63],  // F:   F3, A3, C4
  [130.81, 164.81, 196.00],  // C:   C3, E3, G3
  [196.00, 246.94, 293.66],  // G:   G3, B3, D4
];

// Each chord lasts 4 beats
const BEATS_PER_CHORD = 4;

/**
 * Generate a soft sine tone with envelope
 */
function generateTone(
  buffer: Float32Array,
  frequency: number,
  startSample: number,
  durationSamples: number,
  amplitude: number,
): void {
  const attackSamples = Math.min(Math.floor(SAMPLE_RATE * 0.05), durationSamples);
  const releaseSamples = Math.min(Math.floor(SAMPLE_RATE * 0.15), durationSamples);

  for (let i = 0; i < durationSamples; i++) {
    const sampleIndex = startSample + i;
    if (sampleIndex >= buffer.length) break;

    // Simple sine wave
    const t = i / SAMPLE_RATE;
    let sample = Math.sin(2 * Math.PI * frequency * t);

    // Apply ADSR envelope
    let envelope = 1.0;
    if (i < attackSamples) {
      envelope = i / attackSamples;
    } else if (i > durationSamples - releaseSamples) {
      envelope = (durationSamples - i) / releaseSamples;
    }

    buffer[sampleIndex] += sample * amplitude * envelope;
  }
}

/**
 * Generate a soft kick/pulse hit
 */
function generateKick(
  buffer: Float32Array,
  startSample: number,
  amplitude: number,
): void {
  const duration = Math.floor(SAMPLE_RATE * 0.08);

  for (let i = 0; i < duration; i++) {
    const sampleIndex = startSample + i;
    if (sampleIndex >= buffer.length) break;

    const t = i / SAMPLE_RATE;
    // Frequency sweep from 150Hz down to 50Hz
    const freq = 150 * Math.exp(-t * 30);
    const sample = Math.sin(2 * Math.PI * freq * t);
    const envelope = Math.exp(-t * 25);

    buffer[sampleIndex] += sample * amplitude * envelope;
  }
}

/**
 * Generate a hi-hat-like noise click
 */
function generateHiHat(
  buffer: Float32Array,
  startSample: number,
  amplitude: number,
): void {
  const duration = Math.floor(SAMPLE_RATE * 0.03);

  for (let i = 0; i < duration; i++) {
    const sampleIndex = startSample + i;
    if (sampleIndex >= buffer.length) break;

    const noise = (Math.random() * 2 - 1);
    const envelope = Math.exp(-(i / SAMPLE_RATE) * 80);

    buffer[sampleIndex] += noise * amplitude * envelope;
  }
}

/**
 * Generate the complete lo-fi demo track audio buffer
 */
function synthesizeBuffer(): Float32Array {
  const totalSamples = SAMPLE_RATE * DURATION_SECONDS;
  const buffer = new Float32Array(totalSamples);

  const samplesPerBeat = Math.floor(BEAT_INTERVAL * SAMPLE_RATE);
  const totalBeats = Math.floor(DURATION_SECONDS / BEAT_INTERVAL);

  for (let beat = 0; beat < totalBeats; beat++) {
    const beatStartSample = beat * samplesPerBeat;
    const chordIndex = Math.floor((beat / BEATS_PER_CHORD) % CHORD_PROGRESSION.length);
    const chord = CHORD_PROGRESSION[chordIndex];

    // Chord pad — continuous sustained tones (soft)
    if (beat % BEATS_PER_CHORD === 0) {
      const chordDuration = samplesPerBeat * BEATS_PER_CHORD;
      for (const freq of chord) {
        generateTone(buffer, freq, beatStartSample, chordDuration, 0.06);
        // Add subtle octave-up harmonic
        generateTone(buffer, freq * 2, beatStartSample, chordDuration, 0.02);
      }
    }

    // Kick on beats 1 and 3
    if (beat % 4 === 0 || beat % 4 === 2) {
      generateKick(buffer, beatStartSample, 0.15);
    }

    // Hi-hat on every beat, softer on offbeats
    const hiHatAmp = (beat % 2 === 0) ? 0.04 : 0.02;
    generateHiHat(buffer, beatStartSample, hiHatAmp);

    // Hi-hat on eighth notes (between beats)
    generateHiHat(buffer, beatStartSample + Math.floor(samplesPerBeat / 2), 0.015);
  }

  // Normalize to prevent clipping
  let maxVal = 0;
  for (let i = 0; i < buffer.length; i++) {
    const abs = Math.abs(buffer[i]);
    if (abs > maxVal) maxVal = abs;
  }
  if (maxVal > 0) {
    const scale = 0.85 / maxVal;
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] *= scale;
    }
  }

  return buffer;
}

/**
 * Convert Float32Array PCM data to a WAV Blob
 */
function float32ToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * blockAlign;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);           // Subchunk1Size (PCM)
  view.setUint16(20, 1, true);            // AudioFormat (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM data — convert Float32 [-1, 1] to Int16
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Generate a complete demo audio WAV blob URL.
 * This is the main export — call it once on app boot.
 */
export function generateDemoAudio(): { blobUrl: string; durationSeconds: number } {
  const samples = synthesizeBuffer();
  const blob = float32ToWavBlob(samples, SAMPLE_RATE);
  const blobUrl = URL.createObjectURL(blob);

  return {
    blobUrl,
    durationSeconds: DURATION_SECONDS,
  };
}
