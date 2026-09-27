<script setup lang="ts">
/**
 * ShortcutLegend.vue — Bottom Engineering Reference Ribbon
 * Displays keyboard shortcuts in monospaced keys
 */
</script>

<template>
  <footer class="border-t border-hairline bg-surface-header py-2 px-6">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-1">
      <div class="flex items-center gap-1.5">
        <kbd class="font-mono text-[10px] bg-surface-muted text-zinc-400 border border-hairline px-1.5 py-0.5 min-w-[24px] text-center">SPACE</kbd>
        <span class="font-mono text-[10px] text-zinc-600 tracking-monastic">STAMP &amp; ADVANCE</span>
      </div>
      <div class="flex items-center gap-1.5">
        <kbd class="font-mono text-[10px] bg-surface-muted text-zinc-400 border border-hairline px-1.5 py-0.5 min-w-[24px] text-center">⌫</kbd>
        <span class="font-mono text-[10px] text-zinc-600 tracking-monastic">UNDO + REWIND 2.5s</span>
      </div>
      <div class="flex items-center gap-1.5">
        <kbd class="font-mono text-[10px] bg-surface-muted text-accent-gold border border-accent-gold/30 px-1.5 py-0.5 min-w-[24px] text-center">CTRL+SPACE</kbd>
        <span class="font-mono text-[10px] text-zinc-500 tracking-monastic">END WORD (ALT+SPACE)</span>
      </div>
      <div class="flex items-center gap-1.5">
        <kbd class="font-mono text-[10px] bg-surface-muted text-zinc-400 border border-hairline px-1.5 py-0.5 min-w-[24px] text-center">⇧+SPACE</kbd>
        <span class="font-mono text-[10px] text-zinc-600 tracking-monastic">INSTRUMENTAL SOLO</span>
      </div>
      <div class="flex items-center gap-1.5">
        <kbd class="font-mono text-[10px] bg-surface-muted text-zinc-400 border border-hairline px-1.5 py-0.5 min-w-[24px] text-center">[</kbd>
        <kbd class="font-mono text-[10px] bg-surface-muted text-zinc-400 border border-hairline px-1.5 py-0.5 min-w-[24px] text-center">]</kbd>
        <span class="font-mono text-[10px] text-zinc-600 tracking-monastic">NUDGE ±50ms</span>
      </div>
      <div class="flex items-center gap-1.5">
        <kbd class="font-mono text-[10px] bg-surface-muted text-zinc-400 border border-hairline px-1.5 py-0.5 min-w-[24px] text-center">ENTER</kbd>
        <span class="font-mono text-[10px] text-zinc-600 tracking-monastic">SEEK LINE</span>
      </div>
      <div class="flex items-center gap-1.5">
        <kbd class="font-mono text-[10px] bg-surface-muted text-zinc-400 border border-hairline px-1.5 py-0.5 min-w-[24px] text-center">1-4</kbd>
        <span class="font-mono text-[10px] text-zinc-600 tracking-monastic">SPEED SELECT</span>
      </div>
      <div class="flex items-center gap-1.5">
        <kbd class="font-mono text-[10px] bg-surface-muted text-zinc-400 border border-hairline px-1.5 py-0.5 min-w-[24px] text-center">↑↓</kbd>
        <span class="font-mono text-[10px] text-zinc-600 tracking-monastic">NAVIGATE</span>
      </div>
      <div class="flex items-center gap-1.5">
        <kbd class="font-mono text-[10px] bg-surface-muted text-zinc-400 border border-hairline px-1.5 py-0.5 min-w-[24px] text-center">M</kbd>
        <span class="font-mono text-[10px] text-zinc-600 tracking-monastic">MUTE</span>
      </div>
    </div>
  </footer>
</template>
