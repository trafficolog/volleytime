<script setup lang="ts">
export type TabItem =
  | { kind?: 'link'; to: string; label: string; icon: string; prefix?: boolean }
  | { kind: 'action'; id: 'menu'; label: string; icon: string }
defineProps<{ items: TabItem[]; actionExpanded?: boolean; actionControls?: string }>()
const emit = defineEmits<{ action: [id: 'menu'] }>()
const route = useRoute()
const isActive = (t: Extract<TabItem, { to: string }>) =>
  t.prefix ? route.path.startsWith(t.to) : route.path === t.to
</script>

<template>
  <nav class="vt-tabbar" aria-label="Разделы">
    <template v-for="t in items" :key="t.kind === 'action' ? t.id : t.to">
      <button
        v-if="t.kind === 'action'"
        type="button"
        :aria-expanded="actionExpanded"
        :aria-controls="actionControls"
        @click="emit('action', t.id)"
      >
        <VtIcon :name="t.icon" :size="20" />
        {{ t.label }}
      </button>
      <NuxtLink
        v-else
        :to="t.to"
        :data-active="isActive(t)"
        :aria-current="isActive(t) ? 'page' : undefined"
      >
        <VtIcon :name="t.icon" :size="20" />
        {{ t.label }}
      </NuxtLink>
    </template>
  </nav>
</template>
