import { pgEnum } from 'drizzle-orm/pg-core'

/**
 * Роль на членстве в группе (30.1.1, P-18, D-31). `assistant` — устаревшее значение: миграция 0047
 * переименовала его в `coach` и вернула в конец enum только для совместимости с прежним runtime
 * (он ещё может записать `assistant` в окне отката приложения). Новый код его не пишет и читает как
 * `coach` (`normalizeRole` в `@volley-time/core`). Удаление — contract-шаг (ADR v3).
 */
export const memberRoleEnum = pgEnum('member_role', [
  'owner',
  'organizer',
  'coach',
  'player',
  'assistant',
])
export const memberStatusEnum = pgEnum('member_status', [
  'pending',
  'active',
  'guest',
  'blocked',
  'left',
  'rejected',
])
