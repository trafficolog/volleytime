import { and, eq, platformStaff, users } from '@volley-time/db'
import {
  PLATFORM_POLICIES,
  PLATFORM_ROLES,
  platformRoleAllows,
  type PlatformPolicy,
  type PlatformRole,
} from '@volley-time/shared'

import { getDb, type ServiceContext } from '../shared/context'

import { ForbiddenError } from './errors'

/**
 * Команда платформы (Root Admin, 19.3.1 → 29.3.1, R-15, D-28). Источник истины — таблица
 * `platform_staff`: одна роль на человека. Флаг `users.is_root_admin` новый код не читает (он
 * остаётся для прежнего runtime в окне отката). Роль — платформенная, а не роль в группе: она не
 * даёт доступа к `/api/organizations/{orgId}/…`, root-ресурсы живут под `/api/platform/…`.
 * Матрица — `PLATFORM_POLICIES` (`packages/shared`), docs/architecture/permissions-v3.md.
 */

export const NOT_STAFF_CODE = 'forbidden.root_only'
export const ROLE_DENIED_CODE = 'forbidden.platform_role'

const notStaff = () =>
  new ForbiddenError(NOT_STAFF_CODE, 'Действие доступно только команде платформы')
const roleDenied = () => new ForbiddenError(ROLE_DENIED_CODE, 'Нет доступа к разделу')

/**
 * Роль активного пользователя в команде платформы по базе на каждый вызов: роль не кешируется в
 * сессии, поэтому смена и снятие действуют со следующего запроса. Заблокированный — не в команде.
 */
export async function getPlatformRole(ctx: ServiceContext): Promise<PlatformRole | null> {
  const [row] = await getDb(ctx)
    .select({ role: platformStaff.role })
    .from(platformStaff)
    .innerJoin(users, eq(users.id, platformStaff.userId))
    .where(and(eq(platformStaff.userId, ctx.userId), eq(users.isActive, true)))
  return row?.role ?? null
}

/**
 * Проверить роль: не член команды — 403 `forbidden.root_only`, роль вне списка — 403
 * `forbidden.platform_role` («Нет доступа к разделу»). Пустой список — любой член команды.
 */
export async function assertPlatformRole(
  ctx: ServiceContext,
  roles: readonly PlatformRole[] = PLATFORM_ROLES,
): Promise<PlatformRole> {
  const role = await getPlatformRole(ctx)
  if (!role) throw notStaff()
  if (!roles.includes(role)) throw roleDenied()
  return role
}

/**
 * Второй рубеж сервисов Root Admin после `requirePlatformRole` в API: политика матрицы R-15. Без
 * политики — любой член команды (чтение, которое API уже ограничило по разделу).
 */
export async function assertRootAdmin(
  ctx: ServiceContext,
  policy?: PlatformPolicy,
): Promise<PlatformRole> {
  return assertPlatformRole(ctx, policy ? PLATFORM_POLICIES[policy] : PLATFORM_ROLES)
}

export { platformRoleAllows }
