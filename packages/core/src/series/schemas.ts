import { SERIES_MAX_DATES } from '@volley-time/shared'
import { z } from 'zod'

import { CloseBeforeMinutes } from '../events/schemas'
import { LevelCode } from '../levels/schemas'

const IsoDay = z.iso.date()
const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM')

/**
 * Правило повтора (ADR v3 «Серии и черновики»): форма — здесь, смысловые проверки (дни недели,
 * ровно одно из until/count, лимит дат) — `expandSeriesRule` (series.invalid_rule / too_many_dates).
 */
export const SeriesRuleInput = z
  .object({
    freq: z.enum(['once', 'weekly', 'biweekly']),
    weekdays: z.array(z.number().int()).max(7).default([]),
    startDate: IsoDay,
    until: IsoDay.optional(),
    count: z.number().int().min(1).max(SERIES_MAX_DATES).optional(),
  })
  .strict()

/** Поля события серии: время начала по часам группы и длительность вместо startsAt/endsAt. */
export const SeriesTemplateInput = z
  .object({
    type: z.enum(['training', 'open_game', 'custom']).default('training'),
    title: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    venueId: z.number().int().positive().optional(),
    locationText: z.string().max(300).optional(),
    startTime: LocalTime,
    durationMinutes: z.number().int().min(15).max(1440),
    capacity: z.number().int().positive().max(500),
    // без priceMode/joinMode — умолчания группы, как у одиночного события (19.2.2, 20.1.3)
    priceMode: z.enum(['fixed', 'split']).optional(),
    price: z.number().int().min(0).max(2147483647).default(0),
    targetAmount: z.number().int().min(1).max(2147483647).nullable().default(null),
    level: LevelCode.nullable().optional(),
    joinMode: z.enum(['open', 'invite']).optional(),
    // срок закрытия записи дат серии (20.3.1); без поля — 120 мин
    closeBeforeMinutes: CloseBeforeMinutes.optional(),
  })
  .strict()
export type SeriesTemplate = z.output<typeof SeriesTemplateInput>

const IdempotencyKey = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/)

/**
 * POST …/series/preview — то же тело, что создание; ключ необязателен и игнорируется, чтобы клиент
 * мог отправить один и тот же объект в предпросмотр и в создание.
 */
export const PreviewSeriesInput = z
  .object({
    rule: SeriesRuleInput,
    exceptions: z.array(IsoDay).max(SERIES_MAX_DATES).default([]),
    template: SeriesTemplateInput,
    idempotencyKey: IdempotencyKey.optional(),
  })
  .strict()
export type PreviewSeriesInput = z.input<typeof PreviewSeriesInput>

/**
 * POST …/series. `idempotencyKey` обязателен (решение координатора 2026-10-15): клиент генерирует его
 * один раз на попытку создания; повтор с тем же ключом возвращает уже созданную серию.
 */
export const CreateSeriesInput = PreviewSeriesInput.extend({ idempotencyKey: IdempotencyKey })
export type CreateSeriesInput = z.input<typeof CreateSeriesInput>

/** PATCH …/series/{id}?scope=single|following&from=YYYY-MM-DD */
export const UpdateSeriesQuery = z.object({
  scope: z.enum(['single', 'following']),
  from: IsoDay,
})
export type UpdateSeriesQuery = z.input<typeof UpdateSeriesQuery>

export const UpdateSeriesInput = z
  .object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    venueId: z.number().int().positive().nullable().optional(),
    locationText: z.string().max(300).nullable().optional(),
    startTime: LocalTime.optional(),
    durationMinutes: z.number().int().min(15).max(1440).optional(),
    capacity: z.number().int().positive().max(500).optional(),
    priceMode: z.enum(['fixed', 'split']).optional(),
    price: z.number().int().min(0).max(2147483647).optional(),
    targetAmount: z.number().int().min(1).max(2147483647).nullable().optional(),
    level: LevelCode.nullable().optional(),
    joinMode: z.enum(['open', 'invite']).optional(),
    closeBeforeMinutes: CloseBeforeMinutes.optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update' })
export type UpdateSeriesInput = z.input<typeof UpdateSeriesInput>

/** POST …/series/{id}/cancel — отменить дату `from` и все последующие. */
export const CancelSeriesInput = z.object({ from: IsoDay }).strict()
export type CancelSeriesInput = z.input<typeof CancelSeriesInput>
