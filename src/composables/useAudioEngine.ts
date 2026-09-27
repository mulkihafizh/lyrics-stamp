/**
 * Audio Engine Composable
 *
 * Wraps HTMLAudioElement with:
 * - Pitch-preserved speed changes (preservesPitch = true)
 * - High-frequency RAF-driven time updates (~60fps)
 * - Play, pause, toggle, seek, rewind
 * - Reactive refs for currentTime, duration, isPlaying
 */

import { ref, onUnmounted } from 'vue';

export function useAudioEngine() {
  const audio = new Audio();
  audio.preservesPitch = true;
  audio.crossOrigin = 'anonymous';

  // Reactive state
  const currentTime = ref(0);
  const duration = ref(0);
  const isPlaying = ref(false);
  const playbackRate = ref(1.0);

  // Volume state (persisted)
  const savedVol = typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('lyrics-stamp-volume') || '0.85') : 0.85;
  const volume = ref(isNaN(savedVol) ? 0.85 : Math.max(0, Math.min(1, savedVol)));
  const isMuted = ref(volume.value === 0);
  let previousVolume = volume.value > 0 ? volume.value : 0.85;

  audio.volume = isMuted.value ? 0 : volume.value;

  let rafId: number | null = null;

  // ── RAF Loop for smooth time updates ──
  function startRAFLoop() {
    const tick = () => {
      currentTime.value = audio.currentTime;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function stopRAFLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // ── Event Listeners ──
  audio.addEventListener('loadedmetadata', () => {
    duration.value = audio.duration;
  });

  audio.addEventListener('durationchange', () => {
    duration.value = audio.duration;
  });

  audio.addEventListener('play', () => {
    isPlaying.value = true;
    startRAFLoop();
  });

  audio.addEventListener('pause', () => {
    isPlaying.value = false;
    stopRAFLoop();
    currentTime.value = audio.currentTime;
  });

  audio.addEventListener('ended', () => {
    isPlaying.value = false;
    stopRAFLoop();
    currentTime.value = audio.currentTime;
  });

  // ── Public Methods ──
  async function play(): Promise<void> {
    try {
      await audio.play();
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  }

  function pause(): void {
    audio.pause();
  }

  async function toggle(): Promise<void> {
    if (audio.paused) {
      await play();
    } else {
      pause();
    }
  }

  function seek(seconds: number): void {
    const clampedTime = Math.max(0, Math.min(seconds, audio.duration || 0));
    audio.currentTime = clampedTime;
    currentTime.value = clampedTime;
  }

  function rewind(seconds: number = 2.5): void {
    seek(audio.currentTime - seconds);
  }

  function setPlaybackRate(rate: number): void {
    audio.playbackRate = rate;
    playbackRate.value = rate;
  }

  function setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    volume.value = clamped;
    audio.volume = clamped;
    isMuted.value = clamped === 0;
    if (clamped > 0) {
      previousVolume = clamped;
    }
    try {
      localStorage.setItem('lyrics-stamp-volume', String(clamped));
    } catch (_) {}
  }

  function toggleMute(): void {
    if (isMuted.value || volume.value === 0) {
      const restore = previousVolume > 0 ? previousVolume : 0.85;
      setVolume(restore);
    } else {
      previousVolume = volume.value;
      setVolume(0);
    }
  }

  function loadSource(url: string): void {
    const wasPlaying = !audio.paused;
    audio.pause();
    stopRAFLoop();
    audio.src = url;
    audio.load();
    currentTime.value = 0;
    duration.value = 0;
    isPlaying.value = false;

    if (wasPlaying) {
      audio.addEventListener('canplay', () => {
        play();
      }, { once: true });
    }
  }

  function destroy(): void {
    stopRAFLoop();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  // Cleanup on component unmount
  onUnmounted(() => {
    destroy();
  });

  return {
    // Reactive state
    currentTime,
    duration,
    isPlaying,
    playbackRate,
    volume,
    isMuted,

    // Methods
    play,
    pause,
    toggle,
    seek,
    rewind,
    setPlaybackRate,
    setVolume,
    toggleMute,
    loadSource,
    destroy,

    // Raw element (for waveform analysis if needed)
    audioElement: audio,
  };
}
