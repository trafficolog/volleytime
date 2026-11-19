import { and, db, eq, sessions, users } from '@volley-time/db'
import { z } from 'zod'

const Body = z.object({ telegramUserId: z.coerce.bigint() })

/**
 * Уборка после smoke (Task 9.10.4): переименовывает технический аккаунт и удаляет его сессии,
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

  // Флаг is_active не трогаем: он принадлежит платформенной блокировке (22.1.4). Раньше уборка
  // ставила false, и следующий вход smoke получал бы 403 user.blocked; теперь аккаунт включает
  // шаг prepare (решение владельца 2026-11-19), а уборка только переименовывает и закрывает сессии.
  await db.update(users).set({ name: 'Smoke check' }).where(eq(users.id, user.id))
  const removed = await db
    .delete(sessions)
    .where(and(eq(sessions.userId, user.id)))
    .returning({ id: sessions.id })

  return { cleaned: true, userId: user.id, sessionsRemoved: removed.length }
})
