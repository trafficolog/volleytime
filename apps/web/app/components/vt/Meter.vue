<script setup lang="ts">
const props = withDefaults(
  defineProps<{ value: number; max: number; tone?: 'flame' | 'grass' | 'amber'; label?: string }>(),
  { tone: 'flame', label: undefined },
)
const pct = computed(() =>
  props.max > 0 ? Math.min(100, Math.max(0, (props.value / props.max) * 100)) : 0,
)
</script>

<template>
  <div
    class="vt-meter"
    :class="tone !== 'flame' ? `vt-meter--${tone}` : ''"
    role="meter"
    :aria-valuenow="value"
    aria-valuemin="0"
    :aria-valuemax="max"
    :aria-label="label"
  >
    <i :style="{ width: `${pct}%` }" />
  </div>
</template>
