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
  role: z.enum(['organizer', 'coach', 'player']).default('player'),
  status: z.enum(['pending', 'active', 'guest']).default('active'),
  invitedByUserId: z.number().int().positive().optional(),
})
export type AddMemberInput = z.input<typeof AddMemberInput>

/** Назначаемые роли (owner не назначается через UI; передача владения — отдельный поток). */
export const AssignableRole = z.enum(['organizer', 'coach', 'player'])

export const ChangeMemberRoleInput = z.object({ role: AssignableRole })
export type ChangeMemberRoleInput = z.infer<typeof ChangeMemberRoleInput>

/**
 * PATCH …/members/{memberId} (30.1.1, P-18): роль и/или флаг «Принимает оплату» у тренера.
 * `role: 'player'` — «Убрать из команды»: человек остаётся игроком группы.
 */
export const UpdateMemberInput = z
  .object({ role: AssignableRole.optional(), canAcceptPayment: z.boolean().optional() })
  .strict()
  .refine((d) => d.role !== undefined || d.canAcceptPayment !== undefined, {
    message: 'Nothing to update',
  })
export type UpdateMemberInput = z.infer<typeof UpdateMemberInput>

/** Фильтр списка участников по роли (`?role=`); `coach` включает устаревшее `assistant`. */
export const MemberRoleFilter = z.enum(['owner', 'organizer', 'coach', 'player'])
export type MemberRoleFilter = z.infer<typeof MemberRoleFilter>

/** Исключение из группы (21.2.21): причина необязательна, пишется в журнал аудита. */
export const ExcludeMemberInput = z
  .object({
    reason: z
      .string()
      .trim()
      .max(500)
      .nullish()
      .transform((v) => (v ? v : null)),
    /** 21.2.24: исключить и заблокировать в одной транзакции. */
    block: z.boolean().optional().default(false),
  })
  .strict()
export type ExcludeMemberInput = z.input<typeof ExcludeMemberInput>
