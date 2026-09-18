<script setup lang="ts">
/** Аватар: фото или инициалы; цвет стабилен для одного имени (Task 3.9.13). */
const props = withDefaults(
  defineProps<{ name?: string | null; src?: string | null; size?: 'sm' | 'md' | 'lg' }>(),
  { name: '', src: null, size: 'md' },
)
const TONES = ['flame', 'ink', 'amber', 'grass'] as const

const initials = computed(() => {
  const parts = (props.name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]!.charAt(0)
  const second = parts.length > 1 ? parts[1]!.charAt(0) : (parts[0]!.charAt(1) ?? '')
  return (first + second).toUpperCase()
})
const tone = computed(() => {
  let h = 0
  for (const ch of props.name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TONES[h % TONES.length]
})
const failed = ref(false)
</script>

<template>
  <span
    class="vt-avi"
    :class="[size === 'sm' ? 'vt-avi--sm' : size === 'lg' ? 'vt-avi--lg' : '', `vt-avi--${tone}`]"
    :title="name ?? undefined"
  >
    <img v-if="src && !failed" :src="src" :alt="name ?? ''" loading="lazy" @error="failed = true" />
    <template v-else>{{ initials }}</template>
  </span>
</template>
