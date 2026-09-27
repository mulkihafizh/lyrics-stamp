<script setup lang="ts">
/**
 * WaveformRibbon.vue — Interactive Canvas Timeline
 *
 * Features:
 * - Dynamic frequency bar visualization during playback
 * - Click-to-seek on canvas
 * - Vertical timestamp flags (indigo/amber/gold)
 * - Playhead scrub indicator
 */
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useLyricsStudioStore } from '@/stores/lyricsStudio';

const store = useLyricsStudioStore();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
let animationId: number | null = null;

const duration = computed(() => store.playback.duration);
const currentTime = computed(() => store.playback.currentTime);

const emit = defineEmits<{
  seek: [time: number];
}>();

// ── Click to Seek ──
function onCanvasClick(e: MouseEvent) {
  const canvas = canvasRef.value;
  if (!canvas || duration.value === 0) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const ratio = x / rect.width;
  const seekTime = ratio * duration.value;
  emit('seek', seekTime);
}

// ── Render Loop ──
function render() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Clear
  ctx.fillStyle = '#0e0e11';
  ctx.fillRect(0, 0, w, h);

  const dur = duration.value;
  if (dur === 0) {
    // No audio loaded — draw placeholder
    ctx.fillStyle = '#18181e';
    ctx.fillRect(0, h * 0.3, w, h * 0.4);
    ctx.fillStyle = '#232328';
    ctx.font = '10px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillText('NO AUDIO LOADED', w / 2, h / 2 + 3);
    animationId = requestAnimationFrame(render);
    return;
  }

  // ── Draw frequency bars (simulated waveform) ──
  const barCount = Math.floor(w / 3);
  const barWidth = 2;
  const gap = 1;
  const time = currentTime.value;

  for (let i = 0; i < barCount; i++) {
    const barTime = (i / barCount) * dur;
    const isPlayed = barTime <= time;

    // Generate pseudo-random but deterministic bar height
    const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    const rawHeight = (seed - Math.floor(seed));

    // Create more interesting waveform shape
    const envelopePhase = (i / barCount) * Math.PI * 6;
    const envelope = 0.3 + 0.7 * Math.abs(Math.sin(envelopePhase));
    const barHeight = rawHeight * envelope * (h * 0.7);

    const x = i * (barWidth + gap);
    const y = (h - barHeight) / 2;

    if (isPlayed) {
      ctx.fillStyle = 'rgba(129, 140, 248, 0.6)'; // indigo
    } else {
      ctx.fillStyle = '#1b1b22';
    }

    ctx.fillRect(x, y, barWidth, barHeight);
  }

  // ── Draw timestamp flags ──
  const track = store.activeTrack;
  if (track) {
    for (let i = 0; i < track.lyrics.length; i++) {
      const line = track.lyrics[i];
      if (line.timestamp === null) continue;

      const flagX = (line.timestamp / dur) * w;

      if (i === store.playback.activeLineIndex) {
        // Active line — gold crosshair
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
      } else if (line.isInstrumentalGap) {
        // Instrumental gap — amber
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.5)';
        ctx.lineWidth = 1;
      } else {
        // Normal stamped line — subtle indigo
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.25)';
        ctx.lineWidth = 1;
      }

      ctx.beginPath();
      ctx.moveTo(flagX, 0);
      ctx.lineTo(flagX, h);
      ctx.stroke();
    }
  }

  // ── Draw playhead ──
  const playheadX = (time / dur) * w;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(playheadX, 0);
  ctx.lineTo(playheadX, h);
  ctx.stroke();

  // Playhead triangle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(playheadX - 4, 0);
  ctx.lineTo(playheadX + 4, 0);
  ctx.lineTo(playheadX, 6);
  ctx.closePath();
  ctx.fill();

  animationId = requestAnimationFrame(render);
}

// ── Resize Handling ──
function resizeCanvas() {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  const ctx = canvas.getContext('2d');
  if (ctx) ctx.scale(dpr, dpr);
  // Reset actual drawing dimensions
  canvas.width = rect.width;
  canvas.height = rect.height;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  resizeCanvas();
  render();

  resizeObserver = new ResizeObserver(resizeCanvas);
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  if (animationId !== null) cancelAnimationFrame(animationId);
  resizeObserver?.disconnect();
});
</script>

<template>
  <div
    ref="containerRef"
    class="w-full h-16 bg-canvas border-b border-hairline cursor-crosshair relative"
  >
    <canvas
      ref="canvasRef"
      class="w-full h-full block"
      @click="onCanvasClick"
    />
  </div>
</template>
