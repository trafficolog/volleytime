import { PLAYER_POSITION_CODES } from '@volley-time/db'
import { z } from 'zod'

import { LevelCode } from '../levels/schemas'

/** Уровень игрока в группе (19.2.3); null снимает уровень. Неизвестные ключи запрещены. */
export const SetMemberLevelInput = z.object({ level: LevelCode.nullable() }).strict()
export type SetMemberLevelInput = z.infer<typeof SetMemberLevelInput>

/** Амплуа игрока в группе (21.2.22); null снимает амплуа. Неизвестные ключи запрещены. */
export const PositionCode = z.enum(PLAYER_POSITION_CODES)
export const SetMemberPositionInput = z.object({ position: PositionCode.nullable() }).strict()
export type SetMemberPositionInput = z.infer<typeof SetMemberPositionInput>

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

/** Исключение из группы (21.2.21): причина необязательна, пишется в журнал аудита. */
export const ExcludeMemberInput = z
  .object({
    reason: z
      .string()
      .trim()
      .max(500)
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .strict()
export type ExcludeMemberInput = z.input<typeof ExcludeMemberInput>
