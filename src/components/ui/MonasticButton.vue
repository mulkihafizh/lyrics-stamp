<script setup lang="ts">
/**
 * MonasticButton.vue — Hairline-bordered tactile button
 */

defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}>();

defineEmits<{
  click: [e: MouseEvent];
}>();
</script>

<template>
  <button
    class="inline-flex items-center justify-center font-mono uppercase tracking-monastic border transition-surface cursor-pointer select-none"
    :class="[
      // Size
      size === 'sm' && 'text-[10px] px-2.5 py-1 gap-1.5',
      (!size || size === 'md') && 'text-[11px] px-3.5 py-1.5 gap-2',
      size === 'lg' && 'text-xs px-5 py-2 gap-2.5',
      // Variant
      (!variant || variant === 'primary') && 'bg-white text-[#0e0e11] border-white/90 hover:bg-zinc-200 active:bg-zinc-300',
      variant === 'secondary' && 'bg-surface text-zinc-300 border-hairline hover:bg-surface-hover hover:text-white active:bg-surface-muted',
      variant === 'ghost' && 'bg-transparent text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-surface-hover active:bg-surface-muted',
      variant === 'danger' && 'bg-accent-rose/10 text-accent-rose border-accent-rose/30 hover:bg-accent-rose/20 active:bg-accent-rose/30',
      // Disabled
      disabled && 'opacity-40 pointer-events-none',
    ]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>
