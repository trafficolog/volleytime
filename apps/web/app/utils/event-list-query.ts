import { eventFilterQuery, type EventFilterKey } from '~/utils/desktop-calendar'

/** Размер страницы списка событий кабинета (21.2.10). */
export const EVENT_PAGE_SIZE = 25
/** Период панели «Фильтры» не шире диапазона API (`MAX_EVENT_RANGE_DAYS`). */
export const EVENT_PERIOD_MAX_DAYS = 62

export interface EventListState {
  tab: EventFilterKey
  view: 'list' | 'calendar'
  q: string
  venueId: number | null
  from: string
  to: string
  page: number
  panel: boolean
}

const TABS: readonly EventFilterKey[] = ['all', 'open', 'past', 'cancelled']
const DAY = /^\d{4}-\d{2}-\d{2}$/
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000

function one(value: unknown): string {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' ? v : ''
}

/** Ошибка периода или `null`: обе даты, `до` не раньше `с`, не шире `EVENT_PERIOD_MAX_DAYS`. */
export function periodError(from: string, to: string): string | null {
  if (!from && !to) return null
  if (!DAY.test(from) || !DAY.test(to) || Number.isNaN(dayNumber(from) + dayNumber(to)))
    return 'Укажите обе даты периода'
  const days = dayNumber(to) - dayNumber(from) + 1
  if (days < 1) return 'Дата «по» раньше даты «с»'
  if (days > EVENT_PERIOD_MAX_DAYS) return `Период не больше ${EVENT_PERIOD_MAX_DAYS} дней`
  return null
}

/** Состояние списка из query строки адреса; всё некорректное сбрасывается к умолчанию. */
export function parseEventListQuery(query: Record<string, unknown>): EventListState {
  const tab = one(query.tab) as EventFilterKey
  const venue = Number(one(query.venue))
  const page = Number(one(query.page))
  const from = one(query.from)
  const to = one(query.to)
  const validPeriod = from !== '' && to !== '' && periodError(from, to) === null
  return {
    tab: TABS.includes(tab) ? tab : 'all',
    view: one(query.view) === 'calendar' ? 'calendar' : 'list',
    q: one(query.q).slice(0, 200),
    venueId: Number.isInteger(venue) && venue > 0 ? venue : null,
    from: validPeriod ? from : '',
    to: validPeriod ? to : '',
    page: Number.isInteger(page) && page > 1 ? page : 1,
    panel: one(query.panel) === '1',
  }
}

/** Query адреса: значения по умолчанию опускаются. */
export function eventListRouteQuery(state: EventListState): Record<string, string> {
  const out: Record<string, string> = {}
  if (state.tab !== 'all') out.tab = state.tab
  if (state.view === 'calendar') out.view = 'calendar'
  if (state.q) out.q = state.q
  if (state.venueId) out.venue = String(state.venueId)
  if (state.from && state.to) {
    out.from = state.from
    out.to = state.to
  }
  if (state.page > 1) out.page = String(state.page)
  if (state.panel) out.panel = '1'
  return out
}

/** Фильтры без страницы и периода: общие у списка, календаря и выгрузки. */
export function eventFilterParams(state: EventListState): Record<string, string | number> {
  const out: Record<string, string | number> = { ...eventFilterQuery(state.tab) }
  if (state.q.trim()) out.q = state.q.trim()
  if (state.venueId) out.venueId = state.venueId
  return out
}

/** Параметры `GET …/events` для страницы списка. */
export function eventListApiQuery(state: EventListState): Record<string, string | number> {
  const out = eventFilterParams(state)
  if (state.from && state.to) {
    out.from = state.from
    out.to = state.to
  }
  out.limit = EVENT_PAGE_SIZE
  out.offset = (state.page - 1) * EVENT_PAGE_SIZE
  return out
}

/** Ссылка на CSV: те же фильтры, что у списка, без страницы. */
export function eventExportHref(orgId: number, state: EventListState): string {
  const params = new URLSearchParams(
    Object.entries(eventFilterParams(state)).map(([k, v]) => [k, String(v)]),
  )
  if (state.from && state.to) {
    params.set('from', state.from)
    params.set('to', state.to)
  }
  return `/api/organizations/${orgId}/events/export?${params.toString()}`
}

export function eventPageCount(total: number): number {
  return Math.max(1, Math.ceil(total / EVENT_PAGE_SIZE))
}

/** Включён ли хоть один фильтр, поиск или нестандартная фишка статуса. */
export function hasActiveEventFilters(state: EventListState): boolean {
  return state.tab !== 'all' || state.q !== '' || state.venueId !== null || state.from !== ''
}
