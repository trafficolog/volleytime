import { VENUE_HOURLY_PRICE_MAX } from '@volley-time/shared'
import { z } from 'zod'

/** Цена за час в минимальных единицах валюты группы (21.4.13, ADR-21-4-13); null — не указана. */
const HourlyPrice = z.number().int().min(0).max(VENUE_HOURLY_PRICE_MAX).nullable()

export const CreateVenueInput = z.object({
  organizationId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  address: z.string().max(500).optional(),
  capacityHint: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
  hourlyPrice: HourlyPrice.optional(),
})
export type CreateVenueInput = z.input<typeof CreateVenueInput>

export const UpdateVenueInput = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  address: z.string().max(500).nullable().optional(),
  capacityHint: z.number().int().positive().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  hourlyPrice: HourlyPrice.optional(),
})
export type UpdateVenueInput = z.input<typeof UpdateVenueInput>
