<script setup lang="ts">
/**
 * Masthead.vue — Monastic Architectural Header
 * Displays app title, audio engine status, and latency compensation indicator
 */
import { Icon } from '@iconify/vue';
import { useLyricsStudioStore } from '@/stores/lyricsStudio';
import Badge from '@/components/ui/Badge.vue';
import { computed } from 'vue';

const store = useLyricsStudioStore();

const latencyLabel = computed(() => {
  const ms = store.playback.latencyCompensationMs;
  return `${ms}ms LATENCY COMP.`;
});

const modeLabel = computed(() => {
  return store.playback.stampingMode === 'word' ? 'WORD MODE' : 'LINE MODE';
});
</script>

<template>
  <header class="bg-surface-header border-b border-hairline py-3 px-6 flex items-center justify-between">
    <!-- Left: Title Block -->
    <div class="flex flex-col gap-0.5">
      <div class="flex items-center gap-2">
        <span class="font-mono tracking-monastic text-[10px] text-stone-500">
          ■&nbsp;&nbsp;// METADATA &amp; LRC ATELIER
        </span>
      </div>
      <h1 class="font-sans font-bold text-lg text-white leading-tight tracking-tight">
        AUDIO LYRICS SPECIFICATION STUDIO
      </h1>
    </div>

    <!-- Right: Status Badges -->
    <div class="hidden md:flex items-center gap-3">
      <Badge
        :variant="store.playback.stampingMode === 'word' ? 'gap' : 'info'"
        :label="modeLabel"
        :small="true"
      />
      <div class="flex items-center gap-1.5 font-mono text-[10px] tracking-monastic text-zinc-500">
        <Icon icon="lucide:radio" class="w-3 h-3 text-accent-indigo" />
        <span class="text-zinc-400">WEB AUDIO 44.1 kHz // PITCH-PRESERVE</span>
      </div>
      <div class="w-px h-4 bg-hairline" />
      <div class="flex items-center gap-1.5 font-mono text-[10px] tracking-monastic">
        <Icon icon="lucide:timer" class="w-3 h-3 text-accent-gold" />
        <span class="text-zinc-400">{{ latencyLabel }}</span>
      </div>
    </div>
  </header>
</template>
