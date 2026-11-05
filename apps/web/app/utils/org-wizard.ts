/** Мастер создания группы (21.1.7): валидация шагов и тело серии по умолчаниям карточки. */
import { dateToZonedInput } from '@volley-time/shared'

import { buildSeriesRule } from './event-series'

export const WIZARD_STEPS = ['Группа', 'Расписание', 'Готово'] as const

/** Умолчания шага «Расписание»: как в макете `OrgOnboarding` (среда, 20:00, 14 мест). */
export const WIZARD_DEFAULTS = { days: [3], time: '20:00', seats: '14' }

/** Инженерное значение шаблона серии: мастер спрашивает только дни, время и места. */
export const WIZARD_SERIES_DURATION_MINUTES = 120

export const GROUP_NAME_ERROR = 'Название — минимум 2 символа'

export function validateGroupName(name: string): string {
  return name.trim().length < 2 ? GROUP_NAME_ERROR : ''
}

export interface ScheduleFields {
  days: readonly number[]
  time: string
  seats: string
}

export function validateSchedule(fields: ScheduleFields): {
  days: string
  time: string
  seats: string
} {
  const seats = Number(fields.seats)
  return {
    days: fields.days.length ? '' : 'Выберите хотя бы один день',
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(fields.time) ? '' : 'Укажите время, например 20:00',
    seats:
      fields.seats.trim() !== '' && Number.isInteger(seats) && seats >= 1 && seats <= 500
        ? ''
        : 'Мест — от 1 до 500',
  }
}

const DAY_MS = 86_400_000

/** Завтрашний день по часам группы: первая дата серии не должна оказаться в прошлом. */
export function wizardStartDate(now: Date, tz: string): string {
  const today = dateToZonedInput(now, tz).slice(0, 10)
  return new Date(Date.parse(`${today}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10)
}

export interface WizardSeriesInput extends ScheduleFields {
  name: string
  startDate: string
}

/** Тело POST …/series/preview и …/series: weekly на месяц, тренировка 120 минут, название = группа. */
export function buildWizardSeries(input: WizardSeriesInput) {
  return {
    rule: buildSeriesRule({
      freq: 'weekly',
      weekdays: input.days,
      startDate: input.startDate,
      endMode: 'span',
      span: 'month',
      count: 1,
    }),
    exceptions: [] as string[],
    template: {
      type: 'training' as const,
      title: input.name.trim(),
      startTime: input.time,
      durationMinutes: WIZARD_SERIES_DURATION_MINUTES,
      capacity: Number(input.seats),
    },
  }
}
