<script setup lang="ts">
import NotificationFeedItem from '~/components/NotificationFeedItem.vue'
import {
  groupNotificationsByDay,
  notificationTime,
  notificationView,
  type FeedNotification,
} from '~/utils/notification-feed'

definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

/** Лента уведомлений игрока (20.4.9, M-13; API — 20.3.2): уведомления группы, новые сверху. */
interface FeedPage {
  items: FeedNotification[]
  nextCursor: string | null
  unreadCount: number
}

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/m/orgs/${orgId.value}`)
const { tz } = useOrgTimezone(orgId)

const items = ref<FeedNotification[]>([])
const nextCursor = ref<string | null>(null)
const unreadCount = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const actionError = ref('')
let seq = 0

async function fetchPage(cursor?: string) {
  return await $fetch<FeedPage>('/api/notifications', {
    query: { organizationId: orgId.value, cursor },
  })
}

async function load() {
  const mine = ++seq
  loading.value = true
  loadError.value = ''
  try {
    const page = await fetchPage()
    if (mine !== seq) return
    items.value = page.items
    nextCursor.value = page.nextCursor
    unreadCount.value = page.unreadCount
  } catch (e) {
    if (mine === seq) loadError.value = apiErrorMessage(e, 'Не удалось загрузить уведомления')
  } finally {
    if (mine === seq) loading.value = false
  }
}

async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return
  const mine = seq
  loadingMore.value = true
  actionError.value = ''
  try {
    const page = await fetchPage(nextCursor.value)
    if (mine !== seq) return
    const known = new Set(items.value.map((n) => n.id))
    items.value = [...items.value, ...page.items.filter((n) => !known.has(n.id))]
    nextCursor.value = page.nextCursor
    unreadCount.value = page.unreadCount
  } catch (e) {
    if (mine === seq) actionError.value = apiErrorMessage(e, 'Не удалось загрузить ещё')
  } finally {
    loadingMore.value = false
  }
}

watch(orgId, () => {
  items.value = []
  nextCursor.value = null
  unreadCount.value = 0
  void load()
})
await load()

function markLocally(ids: number[] | 'all') {
  const stamp = new Date().toISOString()
  let marked = 0
  items.value = items.value.map((n) => {
    if (n.readAt || (ids !== 'all' && !ids.includes(n.id))) return n
    marked++
    return { ...n, readAt: stamp }
  })
  unreadCount.value = Math.max(0, unreadCount.value - marked)
}

async function readAll() {
  actionError.value = ''
  const requestedOrg = orgId.value
  try {
    await $fetch('/api/notifications/read', {
      method: 'POST',
      body: { all: true, organizationId: requestedOrg },
    })
    if (requestedOrg === orgId.value) {
      markLocally('all')
      unreadCount.value = 0
    }
  } catch (e) {
    actionError.value = apiErrorMessage(e, 'Не удалось отметить прочитанными')
  }
}

/** Открытие карточки отмечает её прочитанной; переход не ждёт ответа сервера. */
function open(n: FeedNotification) {
  if (n.readAt) return
  markLocally([n.id])
  void $fetch('/api/notifications/read', { method: 'POST', body: { ids: [n.id] } }).catch(() => {
    // отметка не критична: при следующей загрузке ленты уведомление снова будет непрочитанным
  })
}

const groups = computed(() => groupNotificationsByDay(items.value, tz.value))
</script>

<template>
  <div class="min-h-screen">
    <VtMiniHeader title="Уведомления" :back="base">
      <template #right>
        <button
          v-if="unreadCount > 0"
          type="button"
          class="vt-hit-44 text-sm font-semibold text-[var(--vt-flame-ink)]"
          @click="readAll"
        >
          Прочитать всё
        </button>
      </template>
    </VtMiniHeader>
    <main class="px-4 pb-4">
      <p v-if="actionError" class="py-2 text-sm text-vt-rose-ink" role="alert">{{ actionError }}</p>
      <SkeletonList v-if="loading" :count="3" />
      <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />
      <EmptyState
        v-else-if="items.length === 0"
        icon="bell"
        title="Всё прочитано"
        description="Здесь появятся напоминания о тренировках, подтверждения оплат и свободные места из листа ожидания."
      />
      <template v-else>
        <section v-for="g in groups" :key="g.day" class="mb-4" :aria-label="g.day">
          <h2 class="vt-cap px-1 pb-2 pt-2.5 text-vt-mute-2">{{ g.day }}</h2>
          <ul class="flex flex-col gap-2">
            <li v-for="n in g.items" :key="n.id">
              <NotificationFeedItem
                :view="notificationView(n, base)"
                :time="notificationTime(n.createdAt, g.day, tz)"
                :read="n.readAt !== null"
                @open="open(n)"
              />
            </li>
          </ul>
        </section>
        <button
          v-if="nextCursor"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--full"
          :disabled="loadingMore"
          @click="loadMore"
        >
          Показать ещё
        </button>
      </template>
    </main>
  </div>
</template>
