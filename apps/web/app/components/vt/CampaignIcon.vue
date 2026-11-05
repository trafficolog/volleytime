<script setup lang="ts">
/** Плитка иконки сбора (atoms.jsx → CampaignIcon): цвет по виду сбора, `onDark` — на hero-карточке. */
const props = withDefaults(defineProps<{ name?: string; size?: number; onDark?: boolean }>(), {
  name: 'ball',
  size: 44,
  onDark: false,
})

const TILES: Record<string, { bg: string; fg: string }> = {
  ball: { bg: 'var(--vt-orange-soft)', fg: 'var(--vt-orange-ink)' },
  trophy: { bg: 'var(--vt-blue-soft-tile)', fg: 'var(--vt-flame-deep)' },
  shirt: { bg: 'var(--vt-grass-soft)', fg: 'var(--vt-grass-ink)' },
  arena: { bg: 'var(--vt-bone-2)', fg: 'var(--vt-ink-3)' },
  party: { bg: 'var(--vt-amber-soft)', fg: 'var(--vt-amber-ink)' },
  bus: { bg: 'var(--vt-rose-soft)', fg: 'var(--vt-rose-ink)' },
}
const known = computed(() => props.name in TILES)
const tile = computed(() => TILES[known.value ? props.name : 'ball']!)
const iconName = computed(() => (known.value ? props.name : 'ball'))
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center"
    aria-hidden="true"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: `${Math.round(size * 0.32)}px`,
      background: onDark ? 'var(--vt-on-hero-fill)' : tile.bg,
      color: onDark ? 'var(--vt-on-hero)' : tile.fg,
    }"
  >
    <VtIcon :name="iconName" :size="Math.round(size * 0.5)" :stroke-width="1.8" />
  </span>
</template>
