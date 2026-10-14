import { assertRootAdmin } from '@volley-time/core'
import type { H3Event } from 'h3'

import type { AuthedUser } from './auth'

/**
 * Гард root-эндпоинтов `/api/platform/…` (Task 19.3.1, для фазы 22):
 * 401 без сессии, 403 `forbidden.root_only` без `users.is_root_admin`.
 * Флаг читается из базы на каждый запрос — снятие роли действует сразу.
 */
export async function requireRootAdmin(event: H3Event): Promise<AuthedUser> {
  const user = await requireAuth(event)
  try {
    await assertRootAdmin({ userId: user.id })
  } catch (e) {
    handleServiceError(e)
  }
  return user
}
