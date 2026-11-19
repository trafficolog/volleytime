import { auth } from '@volley-time/auth'
import { db, eq, users } from '@volley-time/db'
import type { H3Event } from 'h3'

export interface AuthedUser {
  id: number
}

/**
 * Требует аутентификацию. Единственный источник — сессия better-auth
 * (email-OTP и Telegram Mini App выдают одну и ту же cookie, Task 3.9.4).
 *
 * Платформенная блокировка (22.1.4, `users.is_active = false`) проверяется по базе на каждом
 * запросе: заблокированный получает 403 `user.blocked`, даже если его сессия ещё существует
 * (`platformUsersService.block` закрывает сессии, а эта проверка закрывает окно гонки и ручные
 * правки флага). Один запрос по первичному ключу.
 */
export async function requireAuth(event: H3Event): Promise<AuthedUser> {
  const session = await auth.api.getSession({ headers: event.headers })
  const id = Number(session?.user?.id)
  if (!session?.user || !Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const [row] = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, id))
  if (!row) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (!row.isActive) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      data: { code: 'user.blocked' },
    })
  }
  return { id }
}
