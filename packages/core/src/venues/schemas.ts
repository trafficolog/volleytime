import { z } from 'zod'

export const CreateVenueInput = z.object({
  organizationId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  capacityHint: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
})
export type CreateVenueInput = z.input<typeof CreateVenueInput>

export const UpdateVenueInput = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).nullable().optional(),
  capacityHint: z.number().int().positive().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})
export type UpdateVenueInput = z.input<typeof UpdateVenueInput>
