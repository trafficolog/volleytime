<script setup lang="ts">
import type { EventListItem } from '~/components/EventCard.vue'
import { buildMonthGrid, monthOfInstant, type EventFilterKey } from '~/utils/desktop-calendar'
import { cancelConsequencesOf } from '~/utils/event-cancel'
import {
  eventExportHref,
  eventFilterParams,
  eventListApiQuery,
  eventListRouteQuery,
  eventPageCount,
  hasActiveEventFilters,
  parseEventListQuery,
  type EventListState,
} from '~/utils/event-list-query'
import {
  chatLinkStateOf,
  duplicateEventBody,
  type ChatLinkState,
  type RowAction,
} from '~/utils/event-row'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const orgId = computed(() => Number(route.params.orgId))
const base = computed(() => `/app/orgs/${orgId.value}`)
const { tz } = useOrgTimezone(orgId)
// Фишка статуса, вид, поиск, панель, период, зал и страница живут в адресе (21.2.10):
// переключение «Список / Календарь» и перезагрузка их сохраняют.
const state = computed(() => parseEventListQuery(route.query))
function update(patch: Partial<EventListState>) {
  const next: EventListState = { ...state.value, ...patch }
  // любое изменение фильтра возвращает на первую страницу; вид и сама страница — нет
  if (!('page' in patch) && !('view' in patch) && !('panel' in patch)) next.page = 1
  void router.replace({ query: eventListRouteQuery(next) })
}
const filter = computed<EventFilterKey>({
  get: () => state.value.tab,
  set: (tab) => update({ tab }),
})
const view = computed<'list' | 'calendar'>({
  get: () => state.value.view,
  set: (next) => update({ view: next }),
})
const searchText = ref(state.value.q)
let searchTimer: ReturnType<typeof setTimeout> | undefined
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => update({ q: searchText.value.trim() }), 300)
}
watch(
  () => state.value.q,
  (q) => {
    if (q !== searchText.value.trim()) searchText.value = q
  },
)
const venues = ref<{ id: number; name: string }[]>([])
async function loadVenues() {
  const targetOrgId = orgId.value
  try {
    const result = await $fetch<{ venues: { id: number; name: string }[] }>(
      `/api/organizations/${targetOrgId}/venues`,
    )
    if (orgId.value === targetOrgId) venues.value = result.venues
  } catch {
    // без списка залов панель работает по периоду
    if (orgId.value === targetOrgId) venues.value = []
  }
}
function resetFilters() {
  clearTimeout(searchTimer)
  searchText.value = ''
  update({ tab: 'all', q: '', venueId: null, from: '', to: '' })
}
const exportHref = computed(() => eventExportHref(orgId.value, state.value))
const filtersActive = computed(() => hasActiveEventFilters(state.value))
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
const total = ref(0)
let generation = 0

/** Ключ запроса списка: смена группы, фильтра, поиска или страницы перезагружает таблицу. */
const listKey = computed(() => JSON.stringify([orgId.value, eventListApiQuery(state.value)]))

async function loadPage() {
  const token = ++generation
  const targetOrgId = orgId.value
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<{ events: EventListItem[]; total: number }>(
      `/api/organizations/${targetOrgId}/events`,
      { query: eventListApiQuery(state.value) },
    )
    if (token !== generation || orgId.value !== targetOrgId) return
    events.value = result.events
    total.value = result.total
    // страница за последней (после отмены или смены фильтра): на последнюю
    const last = eventPageCount(result.total)
    if (result.events.length === 0 && result.total > 0 && state.value.page > last)
      update({ page: last })
  } catch (cause) {
    if (token !== generation || orgId.value !== targetOrgId) return
    error.value = apiErrorMessage(cause, 'Не удалось загрузить события')
  } finally {
    if (token === generation) loading.value = false
  }
}

/** Сброс списка и загрузка первой страницы заново: после действия из меню строки. */
const heading = ref<HTMLElement | null>(null)
async function reloadList() {
  if (view.value === 'calendar') void loadCalendar()
  await loadPage()
  // строка с меню исчезла из таблицы: фокус на заголовок страницы, а не на body
  await nextTick()
  heading.value?.focus()
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
// состав в списке не загружен: общие последствия отмены без счёта по местам (D-09, D-13, D-14)
const cancelLines = [
  'Все записи, включая лист ожидания, будут отменены, игроки получат уведомление.',
  ...cancelConsequencesOf(null).lines.slice(1),
]

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
        if (orgId.value === targetOrgId) await reloadList()
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
      if (orgId.value === targetOrgId) await reloadList()
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
          ...eventFilterParams(state.value),
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

const emptyTitle = computed(() => {
  if (filtersActive.value && state.value.tab === 'all') return 'Ничего не найдено'
  if (state.value.tab === 'past') return 'Прошедших событий нет'
  if (state.value.tab === 'cancelled') return 'Отменённых событий нет'
  return filtersActive.value ? 'Ничего не найдено' : 'Событий пока нет'
})

watch(
  listKey,
  (_, previous) => {
    // смена группы очищает таблицу; смена страницы или фильтра держит прежние строки до ответа
    if (previous && (JSON.parse(previous) as unknown[])[0] !== orgId.value) {
      events.value = []
      total.value = 0
    }
    void loadPage()
  },
  { immediate: true },
)
watch(orgId, () => {
  calendarEvents.value = []
  void loadVenues()
})
void loadVenues()
// ключ календаря: фишка, поиск и зал; период панели в календаре не действует (его задаёт месяц)
const calendarKey = computed(() => JSON.stringify(eventFilterParams(state.value)))
watch(orgId, loadChat, { immediate: true })
// Сетка не очищается на время перезагрузки: старые данные остаются до прихода новых.
watch(
  [orgId, calendarKey, month, view],
  () => {
    if (view.value === 'calendar') void loadCalendar()
    else calendarGeneration++
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  generation++
  calendarGeneration++
})
</script>

<template>
  <div class="vt-desktop-events space-y-6">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 ref="heading" tabindex="-1">События</h1>
        <p class="text-vt-mute-2">Все тренировки и игры организации</p>
      </div>
      <div class="vt-desktop-events__filters">
        <VtSegment v-model="view" label="Вид событий" :options="viewOptions" />
        <NuxtLink :to="`${base}/events/new`" class="vt-btn vt-btn--primary vt-btn--sm">
          <VtIcon name="plus" :size="14" /> Создать
        </NuxtLink>
      </div>
    </header>

    <div class="vt-desktop-events__strip">
      <VtSegment v-model="filter" label="Фильтр событий" variant="chips" :options="filterOptions" />
      <div class="vt-desktop-events__strip-end">
        <input
          v-model="searchText"
          type="search"
          class="vt-field"
          aria-label="Поиск по событиям"
          placeholder="Название или зал"
          maxlength="200"
          @input="onSearchInput"
        />
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :aria-expanded="state.panel"
          aria-controls="events-filters"
          @click="update({ panel: !state.panel })"
        >
          Фильтры
        </button>
        <a
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :href="exportHref"
          download
          data-testid="events-export"
        >
          <VtIcon name="arrow-d" :size="14" /> Экспорт
        </a>
      </div>
    </div>
    <div v-if="state.panel" id="events-filters">
      <DesktopEventFilters
        :venues="venues"
        :venue-id="state.venueId"
        :from="state.from"
        :to="state.to"
        :hide-period="view === 'calendar'"
        @change="update($event)"
        @reset="update({ venueId: null, from: '', to: '' })"
      />
    </div>

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
      <ErrorState v-else-if="error && events.length === 0" :message="error" @retry="loadPage()" />
      <template v-else>
        <EmptyState v-if="events.length === 0" icon="calendar" :title="emptyTitle">
          <template #action>
            <button
              v-if="filtersActive"
              type="button"
              class="vt-btn vt-btn--primary"
              @click="resetFilters"
            >
              Сбросить фильтры
            </button>
            <NuxtLink v-else :to="`${base}/events/new`" class="vt-btn vt-btn--primary"
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
        <ErrorState v-if="error && events.length" :message="error" @retry="loadPage()" />
        <DesktopEventPager
          v-if="total > 0"
          :shown="events.length"
          :total="total"
          :page="state.page"
          @page="update({ page: $event })"
        />
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
