<script setup lang="ts">
/**
 * MetricMatrix.vue — 4-Column Spec Sheet Statistics Matrix
 * Displays: Tracks in Census, Pending Sync, Compliant LRC Ready, Engine Tempo
 */
import { useLyricsStudioStore } from '@/stores/lyricsStudio';
import { computed } from 'vue';

const store = useLyricsStudioStore();

const metrics = computed(() => [
  {
    index: '01',
    label: 'TRACKS IN CENSUS',
    value: String(store.censusStats.total).padStart(2, '0'),
    sub: `${store.censusStats.missing} without lyrics`,
    accent: '',
  },
  {
    index: '02',
    label: 'PENDING SYNC',
    value: String(store.censusStats.unsynced).padStart(2, '0'),
    sub: 'Plaintext ready to stamp',
    accent: 'text-accent-terracotta',
  },
  {
    index: '03',
    label: 'COMPLIANT LRC READY',
    value: String(store.censusStats.synced).padStart(2, '0'),
    sub: 'Timestamped & compliant',
    accent: 'text-accent-emerald',
  },
  {
    index: '04',
    label: 'ENGINE TEMPO',
    value: store.playback.playbackRate.toFixed(2) + 'x',
    sub: 'Playback velocity',
    accent: 'text-accent-indigo',
  },
]);
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 border-b border-hairline divide-x divide-hairline bg-surface">
    <div
      v-for="metric in metrics"
      :key="metric.index"
      class="px-4 py-3 lg:px-5 lg:py-4"
    >
      <div class="flex items-baseline gap-2 mb-1">
        <span class="font-mono text-[10px] tracking-monastic text-zinc-600">{{ metric.index }}</span>
        <span class="font-mono text-[10px] tracking-monastic text-zinc-500 uppercase">{{ metric.label }}</span>
      </div>
      <div class="font-mono text-2xl lg:text-3xl font-bold" :class="metric.accent || 'text-white'">
        {{ metric.value }}
      </div>
      <div class="font-mono text-[10px] text-zinc-600 mt-0.5">{{ metric.sub }}</div>
    </div>
  </div>
</template>
