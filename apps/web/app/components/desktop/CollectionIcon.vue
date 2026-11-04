<script setup lang="ts">
import { collectionIconMeta } from '~/utils/desktop-collections'

/** Плитка иконки сбора из макета (`CampaignIcon`, handoff atoms.jsx). */
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 48 })
const meta = computed(() => collectionIconMeta(props.name))
</script>

<template>
  <span
    class="vt-collection-icon"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: `${Math.round(size * 0.32)}px`,
      background: meta.bg,
      color: meta.fg,
    }"
  >
    <VtIcon :name="name" :size="Math.round(size * 0.5)" :stroke-width="1.8" />
  </span>
</template>
