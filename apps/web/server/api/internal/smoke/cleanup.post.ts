import { and, db, eq, sessions, users } from '@volley-time/db'
import { z } from 'zod'

const Body = z.object({ telegramUserId: z.coerce.bigint() })

/**
 * Уборка после smoke (Task 9.10.4): помечает технический аккаунт и удаляет его сессии,
 * чтобы проверка входа после деплоя не оставляла живых сессий в боевой базе.
 * Пользователь не удаляется: на платежах FK RESTRICT, да и удалять строки боевой БД скриптом опасно.
 */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const { telegramUserId } = Body.parse(await readBody(event))

  const user = await db.query.users.findFirst({
    where: eq(users.telegramUserId, telegramUserId),
    columns: { id: true },
  })
  if (!user) return { cleaned: false, reason: 'user_not_found' as const }

  await db.update(users).set({ name: 'Smoke check', isActive: false }).where(eq(users.id, user.id))
  const removed = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, user.id)))
    .returning({ id: sessions.id })

  return { cleaned: true, userId: user.id, sessionsRemoved: removed.length }
})
