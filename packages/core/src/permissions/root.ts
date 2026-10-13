import { eq, users, type User } from '@volley-time/db'

import { getDb, type ServiceContext } from '../shared/context'

import { ForbiddenError } from './errors'

/**
 * Root Admin платформы (Task 19.3.1, готовность к фазе 22).
 * Источник истины — `users.is_root_admin`. Root — платформенная роль, а не роль в группе:
 * она не даёт доступа к `/api/organizations/{orgId}/…` (tenant middleware требует членства),
 * root-ресурсы живут под `/api/platform/…` (ADR v3). Матрица: docs/architecture/permissions-v3.md.
 */
export function isRootAdmin(user: Pick<User, 'isRootAdmin'> | null | undefined): boolean {
  return user?.isRootAdmin === true
}

export function requireRootAdminUser(user: Pick<User, 'isRootAdmin'> | null | undefined): void {
  if (!isRootAdmin(user)) {
    throw new ForbiddenError(
      'forbidden.root_only',
      'Действие доступно только администратору платформы',
    )
  }
}

/**
 * Проверить root по базе на каждый вызов: флаг не кешируется в сессии, поэтому снятие
 * роли действует сразу. Возвращает строку пользователя.
 */
export async function assertRootAdmin(ctx: ServiceContext): Promise<User> {
  const user = await getDb(ctx).query.users.findFirst({ where: eq(users.id, ctx.userId) })
  requireRootAdminUser(user)
  return user!
}
