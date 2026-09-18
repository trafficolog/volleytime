<script setup lang="ts">
export interface TabItem {
  to: string
  label: string
  icon: string
  /** Совпадение по префиксу пути (по умолчанию — точное). */
  prefix?: boolean
}
const props = defineProps<{ items: TabItem[] }>()
const route = useRoute()
const isActive = (t: TabItem) => (t.prefix ? route.path.startsWith(t.to) : route.path === t.to)
void props
</script>

<template>
  <nav class="vt-tabbar" aria-label="Разделы">
    <NuxtLink
      v-for="t in items"
      :key="t.to"
      :to="t.to"
      :data-active="isActive(t)"
      :aria-current="isActive(t) ? 'page' : undefined"
    >
      <VtIcon :name="t.icon" :size="20" />
      {{ t.label }}
    </NuxtLink>
  </nav>
</template>
