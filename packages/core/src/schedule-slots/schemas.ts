import { z } from 'zod'

/** Потолок слотов в группе: защита списка от разрастания, регулярное расписание — единицы слотов. */
export const SCHEDULE_SLOTS_MAX = 50

const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM')

/**
 * Слот расписания (21.2.12). Границы совпадают с шаблоном серии (`SeriesTemplateInput`) и с CHECK
 * таблицы: день ISO 1–7, `HH:MM`, длительность 15–1440, места 1–500, название 2–200.
 * Организация берётся из контекста запроса, не из тела.
 */
const SlotFields = {
  weekday: z.number().int().min(1).max(7),
  startTime: LocalTime,
  durationMinutes: z.number().int().min(15).max(1440),
  title: z.string().trim().min(2).max(200),
  type: z.enum(['training', 'open_game', 'custom']),
  venueId: z.number().int().positive().nullable(),
  capacity: z.number().int().min(1).max(500),
}

export const CreateScheduleSlotInput = z
  .object({
    ...SlotFields,
    durationMinutes: SlotFields.durationMinutes.default(120),
    type: SlotFields.type.default('training'),
    venueId: SlotFields.venueId.default(null),
  })
  .strict()
export type CreateScheduleSlotInput = z.input<typeof CreateScheduleSlotInput>

export const UpdateScheduleSlotInput = z.object(SlotFields).partial().strict()
export type UpdateScheduleSlotInput = z.input<typeof UpdateScheduleSlotInput>

/** Слот для кабинета и формы события: зал приходит с названием и признаком архива. */
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
