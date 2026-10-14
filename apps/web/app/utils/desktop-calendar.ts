import type { EventListItem } from '~/components/EventCard.vue'

export function groupEventsByOrgDay(
  events: readonly EventListItem[],
  timeZone: string,
): Map<string, EventListItem[]> {
  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const groups = new Map<string, EventListItem[]>()
  for (const event of events) {
    const parts = dateFormat.formatToParts(new Date(event.startsAt))
    const part = (type: string) => parts.find((item) => item.type === type)!.value
    const day = `${part('year')}-${part('month')}-${part('day')}`
    const group = groups.get(day) ?? []
    group.push(event)
    groups.set(day, group)
  }
  return groups
}

export function appendDesktopEventPage(
  current: readonly EventListItem[],
  page: readonly EventListItem[],
  offset: number,
): EventListItem[] {
  if (offset !== current.length) return [...current]
  const seen = new Set(current.map((event) => event.id))
  return [
    ...current,
    ...page.filter((event) => {
      if (seen.has(event.id)) return false
      seen.add(event.id)
      return true
    }),
  ]
}

export type EventFilterKey = 'all' | 'open' | 'past' | 'cancelled'

/** Чипы фильтра W-03 → параметры `GET /events`; один набор на список и календарь (20.5.4). */
export function eventFilterQuery(key: EventFilterKey): { filter: string; status?: string } {
  if (key === 'open') return { filter: 'upcoming', status: 'published' }
  if (key === 'past') return { filter: 'past' }
  if (key === 'cancelled') return { filter: 'all', status: 'cancelled' }
  return { filter: 'all' }
}

/** `YYYY-MM` + сдвиг в месяцах. */
export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year!, m! - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Месяц (`YYYY-MM`) момента времени в часовом поясе организации. */
export function monthOfInstant(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(instant)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return `${part('year')}-${part('month')}`
}

export interface MonthCell {
  day: string
  number: number
  inMonth: boolean
  events: EventListItem[]
}

/** Сетка месяца, неделя с понедельника, полные недели; события дня — по времени начала. */
export function buildMonthGrid(
  month: string,
  events: readonly EventListItem[],
  timeZone = 'UTC',
): MonthCell[] {
  const [year, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year!, m! - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const length = new Date(Date.UTC(year!, m!, 0)).getUTCDate()
  const total = Math.ceil((lead + length) / 7) * 7
  const byDay = groupEventsByOrgDay(events, timeZone)
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(Date.UTC(year!, m! - 1, 1 - lead + index))
    const day = date.toISOString().slice(0, 10)
    const list = [...(byDay.get(day) ?? [])].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    return {
      day,
      number: date.getUTCDate(),
      inMonth: day.slice(0, 7) === month,
      events: list,
    }
  })
}
