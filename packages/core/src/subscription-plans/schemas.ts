import { z } from 'zod'

export const CreatePlanInput = z.object({
  organizationId: z.number().int().positive(),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
  totalSessions: z.number().int().positive().max(1000),
  validityDays: z.number().int().positive().max(3650).nullable().optional(),
  price: z.number().int().min(0).default(0),
  currency: z.string().length(3).optional(),
})
export type CreatePlanInput = z.input<typeof CreatePlanInput>

export const UpdatePlanInput = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  totalSessions: z.number().int().positive().max(1000).optional(),
  validityDays: z.number().int().positive().max(3650).nullable().optional(),
  price: z.number().int().min(0).optional(),
})
export type UpdatePlanInput = z.input<typeof UpdatePlanInput>
