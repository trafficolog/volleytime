import { z } from 'zod'

export const AddMemberInput = z.object({
  organizationId: z.number().int().positive(),
  userId: z.number().int().positive(),
  role: z.enum(['organizer', 'assistant', 'player']).default('player'),
  status: z.enum(['pending', 'active', 'guest']).default('active'),
  invitedByUserId: z.number().int().positive().optional(),
})
export type AddMemberInput = z.input<typeof AddMemberInput>

export const ChangeMemberRoleInput = z.object({
  role: z.enum(['organizer', 'assistant', 'player']), // owner не назначается через UI
})
export type ChangeMemberRoleInput = z.infer<typeof ChangeMemberRoleInput>
