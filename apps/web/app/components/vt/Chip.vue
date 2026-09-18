<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'default' | 'solid' | 'flame' | 'amber' | 'grass' | 'rose'
    dot?: boolean
  }>(),
  { tone: 'default', dot: false },
)
</script>

<template>
  <span class="vt-chip" :class="tone !== 'default' ? `vt-chip--${tone}` : ''">
    <span v-if="dot" class="inline-block w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
    <slot />
  </span>
</template>
