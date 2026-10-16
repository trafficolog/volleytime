import { z } from 'zod'

import { LevelCode } from '../levels/schemas'

const pricingFields = {
  priceMode: z.enum(['fixed', 'split']).default('fixed'),
  price: z.number().int().min(0).max(2147483647).default(0),
  targetAmount: z.number().int().min(1).max(2147483647).nullable().default(null),
}

function validPricing(data: {
  priceMode: 'fixed' | 'split'
  price: number
  targetAmount: number | null
}): boolean {
  return data.priceMode === 'split'
    ? data.price === 0 && data.targetAmount !== null
    : data.targetAmount === null
}

export const EventPricingInput = z.object(pricingFields).refine(validPricing, {
  message: 'Split requires price=0 and a target; fixed cannot contain a split target',
  path: ['targetAmount'],
})

export const CreateEventInput = z
  .object({
    type: z.enum(['training', 'open_game', 'custom']).default('training'),
    title: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    venueId: z.number().int().positive().optional(),
    locationText: z.string().max(300).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    capacity: z.number().int().positive().max(500),
    ...pricingFields,
    // без priceMode сервис подставляет defaultPriceMode группы (19.2.2); согласованность
    // режима, цены и цели проверяется в сервисе уже по итоговому режиму
    priceMode: pricingFields.priceMode.removeDefault().optional(),
    // валюта события = валюта организации (6.8.8); передавать не обязательно
    currency: z.string().length(3).optional(),
    // Политика отмены принадлежит группе, событие хранит снимок (D-02, 19.2.2). Поле принимается
    // только для совместимости со старой формой события и игнорируется; уйдёт вместе с 20.5.5.
    cancellationDeadlineHours: z.number().int().min(0).max(720).nullable().optional(),
    // требуемый уровень события (19.2.3); не указан — для любого
    level: LevelCode.nullable().optional(),
    // без joinMode сервис подставляет defaultJoinMode группы (20.1.3); событие может переопределить
    joinMode: z.enum(['open', 'invite']).optional(),
    // время открытия записи (20.3.1, D-09): не указано/null — запись открыта с публикации
    bookingOpensAt: z.coerce.date().nullable().optional(),
    status: z.enum(['draft', 'published']).default('published'),
  })
  .strict()
  // без priceMode согласованность проверяется в сервисе по режиму группы
  .refine((d) => d.priceMode === undefined || validPricing({ ...d, priceMode: d.priceMode }), {
    message: 'Invalid event pricing mode, price or target',
    path: ['targetAmount'],
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
export type CreateEventInput = z.input<typeof CreateEventInput>

export const UpdateEventInput = z
  .object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    venueId: z.number().int().positive().nullable().optional(),
    locationText: z.string().max(300).nullable().optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    capacity: z.number().int().positive().max(500).optional(),
    priceMode: pricingFields.priceMode.removeDefault().optional(),
    price: pricingFields.price.removeDefault().optional(),
    targetAmount: pricingFields.targetAmount.removeDefault().optional(),
    // игнорируется: политика отмены редактируется только в настройках группы (D-02)
    cancellationDeadlineHours: z.number().int().min(0).max(720).nullable().optional(),
    level: LevelCode.nullable().optional(),
    joinMode: z.enum(['open', 'invite']).optional(),
    bookingOpensAt: z.coerce.date().nullable().optional(),
    status: z.enum(['draft', 'published', 'closed', 'finished']).optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.priceMode === 'fixed' && data.targetAmount != null) return false
      if (
        data.priceMode === 'split' &&
        ((data.price !== undefined && data.price !== 0) || data.targetAmount === null)
      )
        return false
      return true
    },
    { message: 'Invalid event pricing mode, price or target', path: ['targetAmount'] },
  )
export type UpdateEventInput = z.input<typeof UpdateEventInput>

/** Максимальная ширина диапазона `from`/`to` в днях (включительно): календарь кабинета, 20.5.4. */
export const MAX_EVENT_RANGE_DAYS = 62
const IsoDay = z.iso.date()
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000

/**
 * `from`/`to` — календарные даты `YYYY-MM-DD` в часовом поясе организации, обе границы включительно:
 * события с началом в [from 00:00, to+1 00:00) по времени организации. Задаются только вместе.
 * В диапазоне страницы не нужны: лимит по умолчанию 500 (иначе 50, максимум 100).
 */
export const ListEventsQuery = z
  .object({
    filter: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
    status: z.enum(['draft', 'published', 'closed', 'finished', 'cancelled']).optional(),
    from: IsoDay.optional(),
    to: IsoDay.optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((q, ctx) => {
    if ((q.from === undefined) !== (q.to === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'from and to must be given together' })
      return
    }
    if (q.from !== undefined && q.to !== undefined) {
      const days = dayNumber(q.to) - dayNumber(q.from) + 1
      if (days < 1)
        ctx.addIssue({ code: 'custom', path: ['to'], message: 'to must not be before from' })
      else if (days > MAX_EVENT_RANGE_DAYS)
        ctx.addIssue({
          code: 'custom',
          path: ['to'],
          message: `range must not exceed ${MAX_EVENT_RANGE_DAYS} days`,
        })
    } else if (q.limit !== undefined && q.limit > 100) {
      ctx.addIssue({ code: 'custom', path: ['limit'], message: 'limit must not exceed 100' })
    }
  })
export type ListEventsQuery = z.input<typeof ListEventsQuery>

/** GET …/events/{id}/price?seats=N (20.1.1): N — целое 1..10 (верхняя граница CHECK max_seats_per_booking). */
export const EventPriceQuery = z.object({
  seats: z.coerce.number().int().min(1).max(10).optional(),
})
export type EventPriceQuery = z.input<typeof EventPriceQuery>
