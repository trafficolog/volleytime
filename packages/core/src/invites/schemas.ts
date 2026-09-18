import { z } from 'zod'

export const CreateInviteInput = z.object({
  organizationId: z.number().int().positive(),
  roleToAssign: z.enum(['player', 'organizer', 'assistant']).default('player'),
  defaultMemberStatus: z.enum(['active', 'pending']).optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresInDays: z.number().int().positive().max(365).optional(),
})
export type CreateInviteInput = z.input<typeof CreateInviteInput>
