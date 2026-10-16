/** Серия событий в форме кабинета (W-04, 20.5.5): правило повтора, предпросмотр, тексты. */
import { isoWeekday, type SeriesFreq } from '@volley-time/shared'

export type SeriesSpan = 'month' | 'quarter' | 'half' | 'year'
export type SeriesEndMode = 'span' | 'count'

export const SERIES_SPANS: { value: SeriesSpan; label: string; months: number }[] = [
  { value: 'month', label: 'Месяц', months: 1 },
  { value: 'quarter', label: 'Квартал', months: 3 },
  { value: 'half', label: 'Полгода', months: 6 },
  { value: 'year', label: 'Год', months: 12 },
]

/** ISO-дни недели 1–7 в порядке недели. */
export const WEEKDAYS: { value: number; short: string; name: string; dative: string }[] = [
  { value: 1, short: 'Пн', name: 'Понедельник', dative: 'понедельникам' },
  { value: 2, short: 'Вт', name: 'Вторник', dative: 'вторникам' },
  { value: 3, short: 'Ср', name: 'Среда', dative: 'средам' },
  { value: 4, short: 'Чт', name: 'Четверг', dative: 'четвергам' },
  { value: 5, short: 'Пт', name: 'Пятница', dative: 'пятницам' },
  { value: 6, short: 'Сб', name: 'Суббота', dative: 'субботам' },
  { value: 7, short: 'Вс', name: 'Воскресенье', dative: 'воскресеньям' },
]

const DAY_MS = 86_400_000

function parseDay(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return { y, m, d }
}

const formatDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * Последний день периода «месяц/квартал/полгода/год» (включительно): день накануне такого же
 * числа через N месяцев; в более коротком месяце — его последний день. Клиент переводит период в
 * `until`, сервер знает только `until` или `count` (ADR «Серии и черновики»).
 */
export function spanEndDate(startDate: string, span: SeriesSpan): string {
  const months = SERIES_SPANS.find((s) => s.value === span)!.months
  const { y, m, d } = parseDay(startDate)
  const total = m - 1 + months
  const year = y + Math.floor(total / 12)
  const month = total % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const end = Date.UTC(year, month, Math.min(d, lastDay))
  return formatDay(end - DAY_MS)
}

export interface SeriesRuleInput {
  freq: SeriesFreq
  weekdays: readonly number[]
  startDate: string
  endMode: SeriesEndMode
  span: SeriesSpan
  count: number
}

export interface SeriesRuleBody {
  freq: SeriesFreq
  weekdays: number[]
  startDate: string
  until?: string
  count?: number
}

/** Правило для API: ровно одно из `until`/`count`; `once` — без дней недели и срока. */
export function buildSeriesRule(input: SeriesRuleInput): SeriesRuleBody {
  if (input.freq === 'once') return { freq: 'once', weekdays: [], startDate: input.startDate }
  const rule: SeriesRuleBody = {
    freq: input.freq,
    weekdays: [...input.weekdays].sort((a, b) => a - b),
    startDate: input.startDate,
  }
  if (input.endMode === 'count') rule.count = input.count
  else rule.until = spanEndDate(input.startDate, input.span)
  return rule
}

/** Переключить день недели; последний выбранный день снять нельзя. */
export function toggleWeekday(current: readonly number[], day: number): number[] {
  if (current.includes(day)) {
    return current.length > 1 ? current.filter((d) => d !== day) : [...current]
  }
  return [...current, day].sort((a, b) => a - b)
}

export function describeSeriesRule(freq: SeriesFreq, weekdays: readonly number[]): string {
  if (freq === 'once') return 'Один раз'
  const days = WEEKDAYS.filter((d) => weekdays.includes(d.value)).map((d) => d.dative)
  const list =
    days.length > 1 ? `${days.slice(0, -1).join(', ')} и ${days.at(-1)}` : (days[0] ?? '')
  return `${freq === 'biweekly' ? 'Раз в две недели' : 'Каждую неделю'} по ${list}`
}

/** Склонение «событие / события / событий» (D-10: единица баланса — «событие»). */
export function eventsWord(n: number): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return 'событий'
  if (mod10 === 1) return 'событие'
  if (mod10 >= 2 && mod10 <= 4) return 'события'
  return 'событий'
}

/** «Сб 6.06» — день недели и день.месяц. */
export function seriesChipLabel(date: string): string {
  const { m, d } = parseDay(date)
  return `${WEEKDAYS[isoWeekday(date) - 1]!.short} ${d}.${String(m).padStart(2, '0')}`
}

export interface SeriesPreviewDate {
  date: string
  startsAt: string
  endsAt: string
  status: 'published' | 'draft'
  draftReason: 'balance' | 'venue_conflict' | null
}

/** Ответ POST …/series/preview (20.2.2). */
export interface SeriesPreviewView {
  timezone: string
  dates: SeriesPreviewDate[]
  excluded: string[]
  total: number
  published: number
  drafts: number
  venueConflicts: number
  balanceEnforced: boolean
  balanceBefore: number
  balanceAfter: number
}

/** Дат-черновиков именно из-за нехватки баланса (зал — отдельная причина, D-04). */
export function balanceDraftCount(preview: SeriesPreviewView): number {
  return preview.dates.filter((d) => d.draftReason === 'balance').length
}

export interface BalanceNote {
  tone: 'neutral' | 'warning'
  text: string
}

/** Последствия для баланса событий до публикации: что спишется, что станет черновиком (D-04). */
export function seriesBalanceNote(preview: SeriesPreviewView): BalanceNote {
  if (!preview.balanceEnforced) {
    return {
      tone: 'neutral',
      text: 'Баланс событий пока не списывается: все даты будут опубликованы.',
    }
  }
  const short = balanceDraftCount(preview)
  if (short > 0) {
    if (preview.published === 0) {
      return {
        tone: 'warning',
        text: `На балансе событий ${preview.balanceBefore}: все ${preview.total} ${eventsWord(preview.total)} будут созданы черновиками до пополнения.`,
      }
    }
    // «нужно» — даты, которые можно опубликовать; даты с занятым залом баланс не требуют (D-04)
    const needed = preview.published + short
    return {
      tone: 'warning',
      text: `Нужно ${needed} ${eventsWord(needed)}, на балансе событий ${preview.balanceBefore}. Опубликуем первые ${preview.published}, остальные ${short} станут черновиками до пополнения.`,
    }
  }
  return {
    tone: 'neutral',
    text: `Спишется ${preview.published} ${eventsWord(preview.published)} из баланса событий — по одному на событие. На балансе ${preview.balanceBefore}, останется ${preview.balanceAfter}.`,
  }
}

export interface SeriesCreatedView {
  total: number
  published: number
  drafts: number
  /** null при повторе по ключу: причина черновика не хранится. */
  venueConflicts: number | null
  balanceAfter: number
  replayed: boolean
}

/** Итог созданной серии (ответ POST …/series) строками для экрана результата. */
export function seriesResultLines(result: SeriesCreatedView): string[] {
  const lines = [
    `Создано ${result.total} ${eventsWord(result.total)}: опубликовано ${result.published}, черновиков ${result.drafts}.`,
  ]
  if (result.venueConflicts) {
    lines.push(
      result.venueConflicts === 1
        ? 'Одна дата создана черновиком: в зале уже есть бронь на это время.'
        : `${result.venueConflicts} даты созданы черновиками: в зале уже есть бронь на это время.`,
    )
  }
  if (result.replayed) {
    lines.push('Это повтор запроса: серия уже была создана, баланс повторно не списан.')
  }
  lines.push(`Баланс событий: осталось ${result.balanceAfter}.`)
  return lines
}

/** Ключ идемпотентности POST …/series: 8–64 символа `[A-Za-z0-9_-]`; один на попытку создания. */
export function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}
