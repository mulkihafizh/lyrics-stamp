<script setup lang="ts">
/**
 * App.vue — Root Container & Global Keyboard Coordinator
 *
 * Assembles the full studio layout and binds global keyboard shortcuts
 * for the stamping workflow.
 */
import { onMounted, onUnmounted, watch } from 'vue';
import { useLyricsStudioStore } from '@/stores/lyricsStudio';
import { useAudioEngine } from '@/composables/useAudioEngine';

import Masthead from '@/components/studio/Masthead.vue';
import MetricMatrix from '@/components/studio/MetricMatrix.vue';
import LibraryDrawer from '@/components/studio/LibraryDrawer.vue';
import WaveformRibbon from '@/components/studio/WaveformRibbon.vue';
import LyricsLedger from '@/components/studio/LyricsLedger.vue';
import PlaybackControls from '@/components/studio/PlaybackControls.vue';
import ExportDrawer from '@/components/studio/ExportDrawer.vue';
import ShortcutLegend from '@/components/studio/ShortcutLegend.vue';

const store = useLyricsStudioStore();
const engine = useAudioEngine();

// ── Sync engine state → store ──
watch(
  () => engine.currentTime.value,
  (time) => { store.playback.currentTime = time; },
);
watch(
  () => engine.duration.value,
  (dur) => { store.playback.duration = dur; },
);
watch(
  () => engine.isPlaying.value,
  (playing) => { store.playback.isPlaying = playing; },
);

// ── Load audio when active track changes ──
watch(
  () => store.activeTrackId,
  () => {
    const track = store.activeTrack;
    if (track?.fileBlobUrl) {
      engine.loadSource(track.fileBlobUrl);
    }
  },
);

// ── Speed rate sync ──
watch(
  () => store.playback.playbackRate,
  (rate) => { engine.setPlaybackRate(rate); },
);

// ── Volume & Mute Sync ──
store.playback.volume = engine.volume.value;
store.playback.isMuted = engine.isMuted.value;
watch(
  () => engine.volume.value,
  (vol) => { store.playback.volume = vol; },
);
watch(
  () => engine.isMuted.value,
  (muted) => { store.playback.isMuted = muted; },
);

// ── Keyboard Shortcuts ──
function handleKeydown(e: KeyboardEvent) {
  // Bypass when typing in inputs
  const target = e.target as HTMLElement;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  ) {
    return;
  }

  // Shortcut: End word timestamp (Ctrl+Space or Alt+Space)
  if ((e.code === 'Space' || e.key === ' ') && (e.ctrlKey || e.altKey || e.metaKey)) {
    e.preventDefault();
    store.endActiveWordTimestamp();
    return;
  }

  switch (e.code) {
    case 'Space': {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Space: Instrumental gap
        store.stampInstrumentalGap();
      } else {
        // Space: Stamp & Advance
        if (!engine.isPlaying.value) {
          engine.play();
        }
        store.stampActiveLine();
      }
      break;
    }

    case 'Backspace': {
      e.preventDefault();
      const result = store.undoLastStamp();
      if (result.shouldRewind) {
        engine.rewind(2.5);
      }
      break;
    }

    case 'BracketLeft': {
      e.preventDefault();
      if (e.shiftKey) {
        store.nudgeGlobalTrack(-50);
      } else {
        const idx = store.playback.activeLineIndex;
        store.nudgeLine(idx, -50);
      }
      break;
    }

    case 'BracketRight': {
      e.preventDefault();
      if (e.shiftKey) {
        store.nudgeGlobalTrack(50);
      } else {
        const idx = store.playback.activeLineIndex;
        store.nudgeLine(idx, 50);
      }
      break;
    }

    case 'Enter': {
      e.preventDefault();
      const track = store.activeTrack;
      if (track) {
        const line = track.lyrics[store.playback.activeLineIndex];
        if (line?.timestamp !== null) {
          engine.seek(line.timestamp!);
        }
      }
      break;
    }

    case 'ArrowUp': {
      e.preventDefault();
      if (store.playback.activeLineIndex > 0) {
        store.playback.activeLineIndex--;
      }
      break;
    }

    case 'ArrowDown': {
      e.preventDefault();
      const track = store.activeTrack;
      if (track && store.playback.activeLineIndex < track.lyrics.length - 1) {
        store.playback.activeLineIndex++;
      }
      break;
    }

    case 'Digit1': {
      e.preventDefault();
      store.playback.playbackRate = 0.75;
      break;
    }
    case 'Digit2': {
      e.preventDefault();
      store.playback.playbackRate = 0.85;
      break;
    }
    case 'Digit3': {
      e.preventDefault();
      store.playback.playbackRate = 1.0;
      break;
    }
    case 'Digit4': {
      e.preventDefault();
      store.playback.playbackRate = 1.15;
      break;
    }
    case 'KeyM': {
      e.preventDefault();
      engine.toggleMute();
      break;
    }
  }
}

// ── Playback Controls Event Handlers ──
async function onToggle() {
  await engine.toggle();
}

function onSetRate(rate: number) {
  store.playback.playbackRate = rate;
  engine.setPlaybackRate(rate);
}

function onSetVolume(vol: number) {
  engine.setVolume(vol);
}

function onToggleMute() {
  engine.toggleMute();
}

function onSeek(time: number) {
  engine.seek(time);
}

// ── Lifecycle ──
onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  store.loadDemoTracks();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="h-screen flex flex-col bg-canvas text-zinc-300 overflow-hidden">
    <!-- Masthead -->
    <Masthead />

    <!-- Metric Matrix -->
    <MetricMatrix />

    <!-- Main Studio Area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left: Library Drawer -->
      <div class="w-[320px] lg:w-[360px] shrink-0 hidden md:block overflow-hidden">
        <LibraryDrawer />
      </div>

      <!-- Center: Studio Workspace -->
      <div class="flex-1 flex flex-col overflow-hidden border-l border-hairline">
        <!-- Waveform -->
        <WaveformRibbon @seek="onSeek" />

        <!-- Lyrics Ledger -->
        <LyricsLedger @seek-line="onSeek" />

        <!-- Playback Controls -->
        <PlaybackControls
          @toggle="onToggle"
          @set-rate="onSetRate"
          @set-volume="onSetVolume"
          @toggle-mute="onToggleMute"
        />

        <!-- Export Drawer -->
        <ExportDrawer />
      </div>
    </div>

    <!-- Shortcut Legend -->
    <ShortcutLegend />

    <!-- Toast Notification -->
    <Transition
      enter-active-class="animate-toast-in"
      leave-active-class="animate-toast-out"
    >
      <div
        v-if="store.toastVisible"
        class="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-surface border border-hairline px-4 py-2 flex items-center gap-2 shadow-lg"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-accent-emerald" />
        <span class="font-mono text-[11px] text-zinc-300">{{ store.toastMessage }}</span>
      </div>
    </Transition>
  </div>
</template>
