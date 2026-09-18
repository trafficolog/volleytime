import { z } from 'zod'

export const BookInput = z.object({
  method: z.enum(['subscription', 'cash', 'transfer', 'online', 'free']),
  subscriptionId: z.number().int().positive().optional(),
})
export type BookInput = z.input<typeof BookInput>

export const AttendanceInput = z
  .array(z.object({ bookingId: z.number().int().positive(), attended: z.boolean() }))
  .min(1)
  .max(500)

export const PageInput = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
