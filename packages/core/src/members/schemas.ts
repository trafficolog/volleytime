import { z } from 'zod'

import { LevelCode } from '../levels/schemas'

/** Уровень игрока в группе (19.2.3); null снимает уровень. Неизвестные ключи запрещены. */
export const SetMemberLevelInput = z.object({ level: LevelCode.nullable() }).strict()
export type SetMemberLevelInput = z.infer<typeof SetMemberLevelInput>

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
