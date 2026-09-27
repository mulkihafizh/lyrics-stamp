<script setup lang="ts">
/**
 * PlaybackControls.vue — Playback Control Deck
 *
 * Features:
 * - Play/Pause button
 * - Time readout (mm:ss.xx / mm:ss.xx)
 * - Speed chips (0.75x, 0.85x, 1.00x, 1.15x)
 * - Latency compensation slider (-250ms to 0ms)
 * - Stamping mode toggle (Line / Word)
 */
import { Icon } from '@iconify/vue';
import { useLyricsStudioStore } from '@/stores/lyricsStudio';
import { formatSecondsToDisplay } from '@/utils/timeFormat';
import { computed } from 'vue';

const store = useLyricsStudioStore();

const emit = defineEmits<{
  toggle: [];
  'set-rate': [rate: number];
  'set-volume': [volume: number];
  'toggle-mute': [];
}>();

function onVolumeChange(e: Event) {
  const input = e.target as HTMLInputElement;
  emit('set-volume', parseFloat(input.value));
}

const speeds = [
  { label: '0.75x', value: 0.75, key: '1' },
  { label: '0.85x', value: 0.85, key: '2' },
  { label: '1.00x', value: 1.0, key: '3' },
  { label: '1.15x', value: 1.15, key: '4' },
];

const timeDisplay = computed(() => {
  const current = formatSecondsToDisplay(store.playback.currentTime);
  const total = formatSecondsToDisplay(store.playback.duration);
  return `${current} / ${total}`;
});

const progressPercent = computed(() => {
  if (store.playback.duration === 0) return 0;
  return (store.playback.currentTime / store.playback.duration) * 100;
});

const syncProgress = computed(() => store.syncProgress);

function updateLatency(e: Event) {
  const input = e.target as HTMLInputElement;
  store.playback.latencyCompensationMs = parseInt(input.value, 10);
}

function toggleMode() {
  store.playback.stampingMode = store.playback.stampingMode === 'line' ? 'word' : 'line';
}
</script>

<template>
  <div class="bg-surface border-t border-hairline px-4 py-3">
    <!-- Progress Bar -->
    <div class="h-0.5 bg-surface-muted mb-3 relative">
      <div
        class="h-full bg-accent-indigo transition-all duration-100"
        :style="{ width: progressPercent + '%' }"
      />
    </div>

    <div class="flex items-center gap-4 flex-wrap">
      <!-- Play/Pause -->
      <button
        class="w-9 h-9 flex items-center justify-center bg-white text-[#0e0e11] hover:bg-zinc-200 active:bg-zinc-300 transition-surface cursor-pointer shrink-0"
        @click="emit('toggle')"
      >
        <Icon
          :icon="store.playback.isPlaying ? 'lucide:pause' : 'lucide:play'"
          class="w-4 h-4"
          :class="!store.playback.isPlaying && 'ml-0.5'"
        />
      </button>

      <!-- Time Readout -->
      <div class="font-mono text-sm text-zinc-300 tabular-nums min-w-[140px]">
        {{ timeDisplay }}
      </div>

      <!-- Sync Progress Indicator -->
      <div class="hidden sm:flex items-center gap-2">
        <div class="w-16 h-1.5 bg-surface-muted relative">
          <div
            class="h-full transition-all duration-300"
            :class="syncProgress >= 100 ? 'bg-accent-emerald' : 'bg-accent-gold'"
            :style="{ width: syncProgress + '%' }"
          />
        </div>
        <span class="font-mono text-[10px] text-zinc-500">{{ syncProgress }}%</span>
      </div>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Stamping Mode Toggle -->
      <button
        class="font-mono text-[10px] tracking-monastic uppercase px-2.5 py-1 border transition-surface cursor-pointer"
        :class="
          store.playback.stampingMode === 'word'
            ? 'bg-accent-gold/15 text-accent-gold border-accent-gold/30'
            : 'bg-transparent text-zinc-500 border-hairline hover:text-zinc-300'
        "
        @click="toggleMode"
      >
        {{ store.playback.stampingMode === 'word' ? '⊞ WORD' : '≡ LINE' }}
      </button>

      <!-- End Word Button (Word Mode) -->
      <button
        v-if="store.playback.stampingMode === 'word'"
        class="font-mono text-[10px] tracking-monastic uppercase px-2 py-1 border border-accent-gold/40 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/25 transition-colors cursor-pointer flex items-center gap-1.5"
        title="End active word timestamp (Shortcut: Ctrl+Space or Alt+Space)"
        @click="store.endActiveWordTimestamp()"
      >
        <span>END WORD</span>
        <kbd class="text-[9px] px-1 bg-surface-muted/60 text-zinc-400 border border-hairline font-mono">⌃␣</kbd>
      </button>

      <!-- Speed Chips -->
      <div class="flex gap-1">
        <button
          v-for="speed in speeds"
          :key="speed.value"
          class="font-mono text-[10px] tracking-wide px-2 py-1 border transition-surface cursor-pointer"
          :class="
            store.playback.playbackRate === speed.value
              ? 'bg-accent-indigo/15 text-accent-indigo border-accent-indigo/30'
              : 'bg-transparent text-zinc-500 border-hairline hover:text-zinc-300 hover:border-hairline-light'
          "
          @click="emit('set-rate', speed.value)"
        >
          {{ speed.label }}
        </button>
      </div>

      <!-- Volume Controller -->
      <div class="flex items-center gap-1.5 px-2 py-1 border border-hairline/60 bg-canvas/40">
        <button
          class="text-zinc-400 hover:text-white transition-colors cursor-pointer p-0.5 flex items-center justify-center"
          :title="store.playback.isMuted || store.playback.volume === 0 ? 'Click to unmute' : 'Click to mute'"
          @click="emit('toggle-mute')"
        >
          <Icon
            :icon="
              store.playback.isMuted || store.playback.volume === 0
                ? 'lucide:volume-x'
                : store.playback.volume < 0.5
                  ? 'lucide:volume-1'
                  : 'lucide:volume-2'
            "
            class="w-3.5 h-3.5"
            :class="(store.playback.isMuted || store.playback.volume === 0) ? 'text-accent-rose' : 'text-zinc-400 hover:text-zinc-200'"
          />
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="store.playback.isMuted ? 0 : store.playback.volume"
          class="w-16 lg:w-20 h-1 accent-zinc-300 hover:accent-white cursor-pointer"
          title="Volume slider"
          @input="onVolumeChange"
        />

        <span class="font-mono text-[9px] text-zinc-400 w-7 text-right tabular-nums">
          {{ store.playback.isMuted || store.playback.volume === 0 ? '0%' : Math.round(store.playback.volume * 100) + '%' }}
        </span>
      </div>

      <!-- Latency Compensation -->
      <div class="hidden lg:flex items-center gap-2">
        <span class="font-mono text-[9px] tracking-monastic text-zinc-600 uppercase">LATENCY</span>
        <input
          type="range"
          :value="store.playback.latencyCompensationMs"
          min="-250"
          max="0"
          step="10"
          class="w-16 h-1 accent-accent-gold cursor-pointer"
          @input="updateLatency"
        />
        <span class="font-mono text-[10px] text-zinc-500 w-10 text-right tabular-nums">
          {{ store.playback.latencyCompensationMs }}ms
        </span>
      </div>
    </div>
  </div>
</template>
