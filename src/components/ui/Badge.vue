<script setup lang="ts">
/**
 * Badge.vue — Monastic Status Tag
 * Displays status indicators: UNSYNCED, SYNCED, GAP, DEMO
 */

defineProps<{
  variant: 'unsynced' | 'synced' | 'gap' | 'demo' | 'info';
  label?: string;
  small?: boolean;
}>();
</script>

<template>
  <span
    class="inline-flex items-center font-mono uppercase border"
    :class="[
      small ? 'text-[9px] px-1.5 py-0 tracking-[0.15em]' : 'text-[10px] px-2 py-0.5 tracking-monastic',
      variant === 'unsynced' && 'bg-accent-terracotta/10 text-accent-terracotta border-accent-terracotta/30',
      variant === 'synced' && 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30',
      variant === 'gap' && 'bg-accent-gold/10 text-accent-gold border-accent-gold/30',
      variant === 'demo' && 'bg-accent-indigo/10 text-accent-indigo border-accent-indigo/30',
      variant === 'info' && 'bg-surface-muted text-zinc-400 border-hairline',
    ]"
  >
    {{ label || variant.toUpperCase() }}
  </span>
</template>
