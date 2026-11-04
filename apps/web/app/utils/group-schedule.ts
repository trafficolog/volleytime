import { buildMonthGrid, monthOfInstant } from './desktop-calendar'
import { participationOf } from './status-model'

import type { EventListItem } from '~/components/EventCard.vue'

/**
 * Расписание группы на месяц (21.1.4, M-11): чистые функции над ответом `GET …/events?from&to`.
 * Дни считаются в часовом поясе организации; месяц — `YYYY-MM`.
 */

/**
 * Точка дня: залитая синяя — «вы идёте», контурная оранжевая — очередь, серый контур — тренировка,
 * бледная — отменено или черновик.
 */
export type ScheduleDot = 'going' | 'queue' | 'plain' | 'muted'

export function scheduleMonthRange(month: string): { from: string; to: string } {
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
  return { from: `${month}-01`, to: `${month}-${String(last.getUTCDate()).padStart(2, '0')}` }
}

/** «Июнь 2026». */
export function scheduleMonthTitle(month: string): string {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${month}-01T00:00:00Z`))
  const name = parts.find((p) => p.type === 'month')?.value ?? ''
  const year = parts.find((p) => p.type === 'year')?.value ?? ''
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

/** «3 июня». */
export function scheduleDayTitle(day: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export const trainingsLabel = (n: number) =>
  `${n} ${plural(n, 'тренировка', 'тренировки', 'тренировок')}`

/** Чем занят игрок в событии; отменённое событие и черновик не считаются участием. */
export function scheduleDot(event: EventListItem): ScheduleDot {
  if (event.status === 'cancelled' || event.status === 'draft') return 'muted'
  const key = participationOf(event.myBooking)?.key
  return key === 'going' ? 'going' : key === 'waitlist' ? 'queue' : 'plain'
}

/** Фильтр «Мои»: я иду или стою в очереди. */
export const isMineEvent = (event: EventListItem) => {
  const dot = scheduleDot(event)
  return dot === 'going' || dot === 'queue'
}

/** Сколько тренировок в месяце: отменённые и черновики — не тренировки. */
export const countTrainings = (events: readonly EventListItem[]) =>
  events.filter((e) => e.status !== 'cancelled' && e.status !== 'draft').length

export const countGoing = (events: readonly EventListItem[]) =>
  events.filter((e) => scheduleDot(e) === 'going').length

export function scheduleSubtitle(events: readonly EventListItem[], role: 'player' | 'org') {
  const base = trainingsLabel(countTrainings(events))
  return role === 'player'
    ? `${base} · вы записаны на ${countGoing(events)}`
    : `${base} · вся группа`
}

export interface ScheduleWeek {
  /** «1–7 июня»; одно число, если день один. */
  label: string
  events: EventListItem[]
}

/** Недели с понедельника; пустые пропускаются, подпись — по первому и последнему дню с событием. */
export function groupScheduleWeeks(
  month: string,
  events: readonly EventListItem[],
  tz: string,
): ScheduleWeek[] {
  const cells = buildMonthGrid(month, events, tz)
  const weeks: ScheduleWeek[] = []
  for (let i = 0; i < cells.length; i += 7) {
    const withEvents = cells.slice(i, i + 7).filter((c) => c.inMonth && c.events.length > 0)
    if (!withEvents.length) continue
    const first = withEvents[0]!
    const last = withEvents[withEvents.length - 1]!
    const monthWord = scheduleDayTitle(last.day).replace(/^\d+\s*/, '')
    weeks.push({
      label:
        first.number === last.number
          ? `${first.number} ${monthWord}`
          : `${first.number}–${last.number} ${monthWord}`,
      events: withEvents.flatMap((c) => c.events),
    })
  }
  return weeks
}

/**
 * День, выбранный по умолчанию. Текущий месяц: сегодня, если есть события, иначе ближайший
 * следующий день с событиями, иначе последний день с событиями. Другой месяц — первый день с событиями.
 */
export function firstEventDay(
  month: string,
  events: readonly EventListItem[],
  tz: string,
  now: Date = new Date(),
): string | null {
  const days = buildMonthGrid(month, events, tz)
    .filter((c) => c.inMonth && c.events.length)
    .map((c) => c.day)
  if (!days.length) return null
  if (monthOfInstant(now, tz) !== month) return days[0]!
  const today = orgDay(now, tz)
  return days.find((d) => d >= today) ?? days[days.length - 1]!
}

/** День (`YYYY-MM-DD`) момента времени в часовом поясе организации. */
function orgDay(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const part = (type: string) => parts.find((item) => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
