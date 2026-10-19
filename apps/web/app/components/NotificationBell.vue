<script setup lang="ts">
/**
 * Колокольчик уведомлений в шапке главной игрока (20.4.9, M-13): ссылка на ленту группы и счётчик
 * непрочитанных (`unreadCount` из `GET /api/notifications`, 20.3.2). Ошибка загрузки счётчика не
 * мешает экрану: колокольчик остаётся без отметки.
 */
const props = defineProps<{ orgId: number }>()

const unread = ref(0)
let seq = 0

async function loadUnread() {
  const mine = ++seq
  try {
    const page = await $fetch<{ unreadCount: number }>('/api/notifications', {
      query: { organizationId: props.orgId, limit: 1 },
    })
    if (mine === seq) unread.value = page.unreadCount
  } catch {
    if (mine === seq) unread.value = 0
  }
}

onMounted(loadUnread)
watch(() => props.orgId, loadUnread)

const label = computed(() =>
  unread.value > 0 ? `Уведомления, новых: ${unread.value}` : 'Уведомления',
)
</script>

<template>
  <NuxtLink
    :to="`/m/orgs/${orgId}/notifications`"
    class="vt-btn vt-btn--ghost vt-btn--sm vt-hit-44 relative"
    :aria-label="label"
    data-notification-bell
  >
    <VtIcon name="bell" :size="18" />
    <span
      v-if="unread > 0"
      data-bell-badge
      class="vt-mono absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-vt-flame px-1 text-[10px] font-bold leading-none text-[var(--vt-on-accent)]"
      aria-hidden="true"
      >{{ unread > 99 ? '99+' : unread }}</span
    >
  </NuxtLink>
</template>
