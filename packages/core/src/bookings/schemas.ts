import { z } from 'zod'

export const BookInput = z.object({
  method: z.enum(['subscription', 'cash', 'transfer', 'online', 'free']),
  subscriptionId: z.number().int().positive().optional(),
  /** Места в записи (20.1.2); верхняя граница — `organizations.max_seats_per_booking` (CHECK 1..10). */
  seats: z.number().int().min(1).max(10).default(1),
  /** Явное согласие игрока: места сверх свободных — в очередь («часть в основу, часть в очередь»). */
  allowWaitlist: z.boolean().default(false),
})
export type BookInput = z.input<typeof BookInput>

/** PATCH …/bookings/{id}: новое общее число мест записи (основа + очередь), 20.1.2. */
export const ChangeSeatsInput = z.object({ seats: z.number().int().min(1).max(10) }).strict()
export type ChangeSeatsInput = z.input<typeof ChangeSeatsInput>

export const AttendanceInput = z
  .array(z.object({ bookingId: z.number().int().positive(), attended: z.boolean() }))
  .min(1)
  .max(500)

export const PageInput = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
