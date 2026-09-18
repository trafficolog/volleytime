import { auth } from '@volley-time/auth'
import type { H3Event } from 'h3'

export interface AuthedUser {
  id: number
}

/**
 * Требует аутентификацию. Единственный источник — сессия better-auth
 * (email-OTP и Telegram Mini App выдают одну и ту же cookie, Task 3.9.4).
 */
export async function requireAuth(event: H3Event): Promise<AuthedUser> {
  const session = await auth.api.getSession({ headers: event.headers })
  const id = Number(session?.user?.id)
  if (!session?.user || !Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return { id }
}
