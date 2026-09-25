import { z } from 'zod'

export const CreateOrganizationInput = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  defaultMemberStatus: z.enum(['active', 'pending']).optional(),
})
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationInput>

export const UpdateOrganizationInput = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  defaultMemberStatus: z.enum(['active', 'pending']).optional(),
  defaultCurrency: z.string().length(3).optional(),
  defaultTimezone: z.string().max(64).optional(),
  subscriptionsEnabled: z.boolean().optional(),
})
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInput>
