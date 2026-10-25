<script setup lang="ts">
import type { EventListItem } from '~/components/EventCard.vue'
import {
  appendDesktopEventPage,
  buildMonthGrid,
  eventFilterQuery,
  monthOfInstant,
  type EventFilterKey,
} from '~/utils/desktop-calendar'
import { cancelConsequencesOf } from '~/utils/event-cancel'
import {
  chatLinkStateOf,
  duplicateEventBody,
  type ChatLinkState,
  type RowAction,
} from '~/utils/event-row'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const toast = useToast()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/app/orgs/${orgId.value}`)
const { tz } = useOrgTimezone(orgId)
const filter = ref<EventFilterKey>('all')
const view = ref<'list' | 'calendar'>('list')
const viewOptions = [
  { value: 'list', label: 'Список' },
  { value: 'calendar', label: 'Календарь' },
]
const filterOptions = [
  { value: 'all', label: 'Все' },
  { value: 'open', label: 'Открыта запись' },
  { value: 'past', label: 'Прошедшие' },
  { value: 'cancelled', label: 'Отменённые' },
]
const month = ref(monthOfInstant(new Date(), tz.value))
const events = ref<EventListItem[]>([])
const calendarEvents = ref<EventListItem[]>([])
const calendarLoading = ref(false)
const calendarError = ref('')
let calendarGeneration = 0
const loading = ref(false)
const error = ref('')
const hasMore = ref(false)
let generation = 0

async function loadPage(offset: number) {
  if (loading.value) return
  const token = generation
  const targetOrgId = orgId.value
  const targetFilter = filter.value
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<{ events: EventListItem[] }>(
      `/api/organizations/${targetOrgId}/events`,
      { query: { ...eventFilterQuery(targetFilter), limit: 50, offset } },
    )
    if (token !== generation || orgId.value !== targetOrgId || filter.value !== targetFilter) return
    events.value = appendDesktopEventPage(events.value, result.events, offset)
    hasMore.value = result.events.length === 50
  } catch (cause) {
    if (token !== generation || orgId.value !== targetOrgId || filter.value !== targetFilter) return
    error.value = apiErrorMessage(cause, 'Не удалось загрузить события')
  } finally {
    if (token === generation) loading.value = false
  }
}

/** Сброс списка и загрузка первой страницы заново: после действия из меню строки. */
function reloadList() {
  generation++
  events.value = []
  loading.value = false
  error.value = ''
  hasMore.value = false
  void loadPage(0)
  if (view.value === 'calendar') void loadCalendar()
}

// Привязка чата группы нужна пункту меню «В чат группы» (20.3.4).
const chat = ref<ChatLinkState>({ kind: 'unknown' })
let chatGeneration = 0
async function loadChat() {
  const token = ++chatGeneration
  const targetOrgId = orgId.value
  chat.value = { kind: 'unknown' }
  let next: ChatLinkState
  try {
    next = chatLinkStateOf(
      await $fetch<{ link: { status: string; invalidReason?: string | null } | null }>(
        `/api/organizations/${targetOrgId}/telegram-chat`,
      ),
    )
  } catch {
    next = chatLinkStateOf(null)
  }
  if (token === chatGeneration && orgId.value === targetOrgId) chat.value = next
}

// Действия меню строки (20.5.8): одно за раз, результат — тост; ответ чужой группы игнорируется.
const busyId = ref<number | null>(null)
const cancelTarget = ref<EventListItem | null>(null)
const cancelOpen = ref(false)
const cancelLines = cancelConsequencesOf(null).lines

async function runAction(
  event: EventListItem,
  work: (targetOrgId: number) => Promise<string>,
  failure: string,
) {
  if (busyId.value !== null) return
  const targetOrgId = orgId.value
  busyId.value = event.id
  try {
    const message = await work(targetOrgId)
    if (orgId.value === targetOrgId) toast.show(message)
  } catch (cause) {
    if (orgId.value === targetOrgId) toast.show(apiErrorMessage(cause, failure), 'danger')
  } finally {
    busyId.value = null
  }
}

function onRowAction(action: RowAction, event: EventListItem) {
  if (action === 'open') {
    void navigateTo(`${base.value}/events/${event.id}`)
  } else if (action === 'cancel') {
    cancelTarget.value = event
    cancelOpen.value = true
  } else if (action === 'duplicate') {
    void runAction(
      event,
      async (targetOrgId) => {
        await $fetch(`/api/organizations/${targetOrgId}/events`, {
          method: 'POST',
          body: duplicateEventBody(event, tz.value),
        })
        if (orgId.value === targetOrgId) reloadList()
        return 'Черновик копии создан: откройте его и опубликуйте'
      },
      'Не удалось дублировать событие',
    )
  } else {
    void runAction(
      event,
      async (targetOrgId) => {
        try {
          await $fetch(`/api/organizations/${targetOrgId}/events/${event.id}/telegram-announce`, {
            method: 'POST',
          })
        } catch (cause) {
          // чат мог стать недействительным: обновляем подсказку пункта
          if (orgId.value === targetOrgId) void loadChat()
          throw cause
        }
        return 'Анонс отправлен в чат группы'
      },
      'Не удалось отправить анонс в чат',
    )
  }
}

function confirmCancel() {
  const event = cancelTarget.value
  if (!event) return
  void runAction(
    event,
    async (targetOrgId) => {
      await $fetch(`/api/organizations/${targetOrgId}/events/${event.id}/cancel`, {
        method: 'POST',
      })
      if (orgId.value === targetOrgId) reloadList()
      return `Событие «${event.title}» отменено`
    },
    'Не удалось отменить событие',
  )
}

/** Календарь грузит выбранный месяц целиком (диапазон from/to), а не страницу списка. */
async function loadCalendar() {
  const token = ++calendarGeneration
  const targetOrgId = orgId.value
  const grid = buildMonthGrid(month.value, [])
  calendarLoading.value = true
  calendarError.value = ''
  try {
    const result = await $fetch<{ events: EventListItem[] }>(
      `/api/organizations/${targetOrgId}/events`,
      {
        query: {
          ...eventFilterQuery(filter.value),
          from: grid[0]!.day,
          to: grid[grid.length - 1]!.day,
        },
      },
    )
    if (token !== calendarGeneration) return
    calendarEvents.value = result.events
  } catch (cause) {
    if (token !== calendarGeneration) return
    calendarError.value = apiErrorMessage(cause, 'Не удалось загрузить события')
  } finally {
    if (token === calendarGeneration) calendarLoading.value = false
  }
}

const emptyTitle = computed(() =>
  filter.value === 'past'
    ? 'Прошедших событий нет'
    : filter.value === 'cancelled'
      ? 'Отменённых событий нет'
      : 'Событий пока нет',
)

watch(
  [orgId, filter],
  () => {
    generation++
    events.value = []
    loading.value = false
    error.value = ''
    hasMore.value = false
    void loadPage(0)
  },
  { immediate: true },
)
watch(orgId, () => {
  calendarEvents.value = []
})
watch(orgId, loadChat, { immediate: true })
// Сетка не очищается на время перезагрузки: старые данные остаются до прихода новых.
watch(
  [orgId, filter, month, view],
  () => {
    if (view.value === 'calendar') void loadCalendar()
    else calendarGeneration++
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  generation++
  calendarGeneration++
})
</script>

<template>
  <div class="vt-desktop-events space-y-6">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 tabindex="-1">События</h1>
        <p class="text-vt-mute-2">Все тренировки и игры организации</p>
      </div>
      <div class="vt-desktop-events__filters">
        <VtSegment v-model="view" label="Вид событий" :options="viewOptions" />
        <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--primary vt-btn--sm">
          <VtIcon name="plus" :size="14" /> Создать
        </NuxtLink>
      </div>
    </header>

    <VtSegment v-model="filter" label="Фильтр событий" variant="chips" :options="filterOptions" />

    <DesktopEventCalendar
      v-if="view === 'calendar'"
      v-model:month="month"
      :events="calendarEvents"
      :time-zone="tz"
      :base="base"
      :loading="calendarLoading"
      :error="calendarError"
      @retry="loadCalendar"
    />
    <template v-else>
      <SkeletonList v-if="loading && events.length === 0" :count="3" />
      <ErrorState v-else-if="error && events.length === 0" :message="error" @retry="loadPage(0)" />
      <template v-else>
        <p class="text-vt-mute-2" role="status">
          Загружено: {{ events.length }}{{ hasMore ? ' · доступны ещё' : '' }}.
        </p>
        <EmptyState v-if="events.length === 0" icon="calendar" :title="emptyTitle">
          <template #action>
            <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--primary"
              >Создать событие</NuxtLink
            >
          </template>
        </EmptyState>
        <DesktopEventTable
          v-else
          :events="events"
          :time-zone="tz"
          :base="base"
          :chat="chat"
          :busy-id="busyId"
          @action="onRowAction"
        />
        <ErrorState
          v-if="error && events.length"
          :message="error"
          @retry="loadPage(events.length)"
        />
        <button
          v-if="hasMore"
          type="button"
          class="vt-btn vt-btn--ghost"
          :disabled="loading"
          @click="loadPage(events.length)"
        >
          {{ loading ? 'Загружаем…' : 'Загрузить ещё' }}
        </button>
      </template>
    </template>

    <VtAlert
      v-model="cancelOpen"
      wide
      danger
      :title="`Отменить событие${cancelTarget ? ` «${cancelTarget.title}»` : ''}?`"
      confirm-label="Отменить событие"
      cancel-label="Не отменять"
      @confirm="confirmCancel"
    >
      <ul class="vt-desktop-event-detail__consequences">
        <li v-for="line in cancelLines" :key="line">{{ line }}</li>
      </ul>
    </VtAlert>
    <VtToast />
  </div>
</template>
