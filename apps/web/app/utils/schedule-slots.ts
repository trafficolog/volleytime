import { dateToZonedInput, isoWeekday } from '@volley-time/shared'

import { WEEKDAYS } from '~/utils/event-series'

/** Слот расписания группы (21.2.12), как его отдаёт `GET …/schedule-slots`. */
export interface ScheduleSlotView {
  id: number
  weekday: number
  startTime: string
  durationMinutes: number
  title: string
  type: 'training' | 'open_game' | 'custom'
  capacity: number
  venueId: number | null
  venueName: string | null
  venueArchived: boolean
}

export const SLOT_TYPE_OPTIONS = [
  { value: 'training', label: 'Тренировка' },
  { value: 'open_game', label: 'Открытая игра' },
  { value: 'custom', label: 'Другое' },
]

export const SLOT_DEFAULTS = { durationMinutes: 120, capacity: 12, type: 'training' } as const

const DAY_MS = 86_400_000
const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

export const weekdayShort = (weekday: number) => WEEKDAYS[weekday - 1]?.short ?? '—'

/**
 * Ближайшее будущее начало слота в часах группы (`YYYY-MM-DDTHH:mm`, как поле формы): сегодня,
 * если время слота ещё не прошло, иначе через неделю.
 */
export function nextSlotStart(
  slot: Pick<ScheduleSlotView, 'weekday' | 'startTime'>,
  tz: string,
  now: Date = new Date(),
): string {
  const local = dateToZonedInput(now, tz)
  const today = local.slice(0, 10)
  let ahead = (slot.weekday - isoWeekday(today) + 7) % 7
  if (ahead === 0 && slot.startTime <= local.slice(11, 16)) ahead = 7
  return `${addDays(today, ahead)}T${slot.startTime}`
}

/** Подпись слота в выборе формы: «Пн 20:00 · Основа · Школа №24». */
export function slotLabel(slot: ScheduleSlotView): string {
  const parts = [`${weekdayShort(slot.weekday)} ${slot.startTime}`, slot.title]
  if (slot.venueName) parts.push(slot.venueArchived ? `${slot.venueName} (архив)` : slot.venueName)
  return parts.join(' · ')
}

export interface SlotFormValues {
  weekday: number
  startTime: string
  title: string
  type: ScheduleSlotView['type']
  durationMinutes: number
  capacity: string
  venueId: string
}

export interface SlotFormErrors {
  startTime?: string
  title?: string
  capacity?: string
  durationMinutes?: string
}

/** Проверка формы слота теми же границами, что на сервере: время `HH:MM`, 2–200 символов, 1–500 мест. */
export function validateSlotForm(values: SlotFormValues): SlotFormErrors {
  const errors: SlotFormErrors = {}
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.startTime)) errors.startTime = 'Укажите время начала'
  const title = values.title.trim()
  if (title.length < 2) errors.title = 'Название — от 2 символов'
  else if (title.length > 200) errors.title = 'Название — не длиннее 200 символов'
  const capacity = values.capacity.trim()
  if (!/^\d+$/.test(capacity) || Number(capacity) < 1 || Number(capacity) > 500)
    errors.capacity = 'Мест — от 1 до 500'
  if (
    !Number.isInteger(values.durationMinutes) ||
    values.durationMinutes < 15 ||
    values.durationMinutes > 1440
  )
    errors.durationMinutes = 'Длительность — от 15 минут до 24 часов'
  return errors
}

/** Тело `POST`/`PATCH` слота из значений формы (значения уже проверены `validateSlotForm`). */
export function slotRequestBody(values: SlotFormValues) {
  return {
    weekday: values.weekday,
    startTime: values.startTime,
    title: values.title.trim(),
    type: values.type,
    durationMinutes: values.durationMinutes,
    capacity: Number(values.capacity),
    venueId: values.venueId === '' ? null : Number(values.venueId),
  }
}
