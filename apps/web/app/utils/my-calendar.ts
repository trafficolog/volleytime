import { DEFAULT_TIMEZONE, formatTime } from '@volley-time/shared'

import { plural } from './group-schedule'
import { overlapsOf, participationOf, type ParticipationKey } from './status-model'

/**
 * Общий календарь игрока (23.2.2, M-10): чистые функции над ответом `GET /api/me/calendar`.
 * Игра попадает в день по часовому поясу СВОЕЙ группы; время показывается в нём же.
 */

export interface MyCalendarGroup {
  id: number
  name: string
  timezone: string
  logoUpdatedAt?: string | null
}

export interface MyCalendarEvent {
  id: number
  organizationId: number
  title: string
  status: string
  startsAt: string
  endsAt: string
  capacity: number
  taken: number
  venue: { name: string } | null
  locationText: string | null
  myBooking: { id: number; status: string; waitPos: number | null; waitlistSeats: number } | null
}

/**
 * Цвет группы: в данных группы цвета нет (решение 23.2.2: без миграции), поэтому он выводится из
 * порядка групп игрока (ответ отсортирован по id) по фиксированному набору токенов. Янтарный занят
 * под пересечения и сюда не входит; групп больше набора — цвета повторяются по кругу.
 */
export const GROUP_COLOR_TOKENS = [
  'var(--vt-group-1)',
  'var(--vt-group-2)',
  'var(--vt-group-3)',
  'var(--vt-group-4)',
] as const

export function groupColors(groups: readonly MyCalendarGroup[]): Map<number, string> {
  return new Map(groups.map((g, i) => [g.id, GROUP_COLOR_TOKENS[i % GROUP_COLOR_TOKENS.length]!]))
}

/** «Только мои» — игры, где я иду или стою в очереди (и мои отменённые); «С местами» — мои и ещё те, куда можно записаться. */
export type MyCalendarFilter = 'mine' | 'seats'

export interface MyCalendarItem {
  event: MyCalendarEvent
  group: MyCalendarGroup
  color: string
  /** День по поясу группы, `YYYY-MM-DD`. */
  day: string
  timeFrom: string
  timeTo: string
  participation: ParticipationKey | null
  freeSeats: number
  /** Я иду в эту игру и в другую по времени (в любой группе). */
  clash: boolean
  past: boolean
  /**
   * Игра отменена (23.2.4). Сервер отдаёт такие события, только если у игрока есть запись на них в
   * любом статусе; в списке они приглушены с подписью «Отменена», в месяце точка приглушена.
   */
  cancelled: boolean
}

function dayInZone(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant))
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function buildMyCalendar(
  events: readonly MyCalendarEvent[],
  groups: readonly MyCalendarGroup[],
  options: { filter: MyCalendarFilter; groupId: number | null; now: Date },
): MyCalendarItem[] {
  const colors = groupColors(groups)
  const byId = new Map(groups.map((g) => [g.id, g]))
  const known = events.filter((e) => byId.has(e.organizationId))
  // пересечение считается по всем моим играм, а не только по показанным: фильтр группы его не прячет
  const goingEvents = known.filter((e) => participationOf(e.myBooking)?.key === 'going')
  const clashing = new Set(
    goingEvents.filter((e) => overlapsOf(e, goingEvents).length > 0).map((e) => e.id),
  )
  const now = options.now.getTime()
  return known
    .map((event): MyCalendarItem => {
      const group = byId.get(event.organizationId)!
      return {
        event,
        group,
        color: colors.get(group.id)!,
        day: dayInZone(event.startsAt, group.timezone),
        timeFrom: formatTime(event.startsAt, group.timezone),
        timeTo: formatTime(event.endsAt, group.timezone),
        participation: participationOf(event.myBooking)?.key ?? null,
        freeSeats: Math.max(0, event.capacity - event.taken),
        clash: clashing.has(event.id),
        past: new Date(event.endsAt).getTime() <= now,
        cancelled: event.status === 'cancelled',
      }
    })
    .filter((item) => {
      if (options.groupId !== null && item.group.id !== options.groupId) return false
      // отменённое событие сервер отдаёт только при записи игрока; запись у него `cancelled`, поэтому
      // участия нет, а показать игру нужно при любом фильтре (23.2.4)
      if (item.cancelled) return item.event.myBooking !== null
      if (item.participation === 'going' || item.participation === 'waitlist') return true
      return (
        options.filter === 'seats' &&
        item.event.status === 'published' &&
        new Date(item.event.startsAt).getTime() > now &&
        item.freeSeats > 0
      )
    })
    .sort(
      (a, b) =>
        Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt) || a.event.id - b.event.id,
    )
}

/** Дни с пересечением, по возрастанию. */
export function calendarClashDays(items: readonly MyCalendarItem[]): string[] {
  return [...new Set(items.filter((i) => i.clash).map((i) => i.day))].sort()
}

export interface MyCalendarCell {
  day: string
  number: number
  inMonth: boolean
  items: MyCalendarItem[]
}

/** Сетка месяца `YYYY-MM`: неделя с понедельника, полные недели. */
export function calendarMonthCells(
  month: string,
  items: readonly MyCalendarItem[],
): MyCalendarCell[] {
  const [year, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year!, m! - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const length = new Date(Date.UTC(year!, m!, 0)).getUTCDate()
  const total = Math.ceil((lead + length) / 7) * 7
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(Date.UTC(year!, m! - 1, 1 - lead + index))
    const day = date.toISOString().slice(0, 10)
    return {
      day,
      number: date.getUTCDate(),
      inMonth: day.slice(0, 7) === month,
      items: items.filter((i) => i.day === day),
    }
  })
}

const MONTHS_PREPOSITIONAL = [
  'январе',
  'феврале',
  'марте',
  'апреле',
  'мае',
  'июне',
  'июле',
  'августе',
  'сентябре',
  'октябре',
  'ноябре',
  'декабре',
]

/** Сегодня (`YYYY-MM-DD`) по поясу первой группы игрока; групп нет — пояс по умолчанию. */
export function calendarToday(groups: readonly MyCalendarGroup[], now: Date): string {
  return dayInZone(now.toISOString(), groups[0]?.timezone ?? DEFAULT_TIMEZONE)
}

/** «Сегодня», «Завтра», иначе «Ср, 10 июня». */
export function calendarDayTitle(day: string, today: string): string {
  if (day === today) return 'Сегодня'
  const next = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  if (day === next) return 'Завтра'
  const text = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/**
 * День, выбранный по умолчанию: в текущем месяце сегодня, если есть игры, иначе ближайший день с
 * играми, иначе последний; в другом месяце — первый день с играми.
 */
export function defaultCalendarDay(cells: readonly MyCalendarCell[], today: string): string | null {
  const days = cells.filter((c) => c.inMonth && c.items.length).map((c) => c.day)
  if (!days.length) return null
  const inMonth = cells.find((c) => c.inMonth)!.day.slice(0, 7) === today.slice(0, 7)
  if (!inMonth) return days[0]!
  return days.find((d) => d >= today) ?? days[days.length - 1]!
}

/** «3 группы · 14 записей в июне»: записи — игры месяца, куда я иду. */
export function myCalendarSubtitle(
  groups: readonly MyCalendarGroup[],
  events: readonly MyCalendarEvent[],
  month: string,
): string {
  const going = events.filter((e) => participationOf(e.myBooking)?.key === 'going').length
  const n = groups.length
  return (
    `${n} ${plural(n, 'группа', 'группы', 'групп')} · ` +
    `${going} ${plural(going, 'запись', 'записи', 'записей')} в ${MONTHS_PREPOSITIONAL[Number(month.slice(5, 7)) - 1]}`
  )
}
