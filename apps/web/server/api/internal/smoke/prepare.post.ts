import { and, db, eq, organizationMembers, platformStaff, sql, users } from '@volley-time/db'
import { z } from 'zod'

const Body = z.object({ telegramUserId: z.coerce.bigint() })

/** Имя, которое оставляет уборка (cleanup.post.ts) на техническом аккаунте. */
const SMOKE_NAME = 'Smoke check'

/**
 * Подготовка smoke перед входом (решение владельца 2026-11-19, «re-enable on each deploy»).
 *
 * С 22.1.4 `users.is_active = false` не пускает ни в сессию, ни в API, а старая уборка (9.10.4)
 * оставляла технический аккаунт неактивным. Шаг включает его обратно перед Telegram-входом smoke.
 *
 * Защита от превращения в «разблокировщик»: включается ТОЛЬКО пользователь с этим Telegram id,
 * который одновременно (1) не root-админ, (2) без единого членства в группах (в любом статусе)
 * и (3) носит имя «Smoke check», которое ставит только уборка. Любой другой заблокированный
 * пользователь (блокировка root из 22.1.4, реальный игрок, организатор) остаётся заблокированным:
 * ответ `{ prepared: false, reason: 'not_smoke_account' }`. Нет пользователя — не ошибка: первый
 * вход создаст аккаунт. В ответе нет секретов и персональных данных, в журнал платформы не пишем
 * (технический аккаунт, на каждый деплой), блокировка root остаётся единственным источником записей.
 */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const { telegramUserId } = Body.parse(await readBody(event))

  const user = await db.query.users.findFirst({
    where: eq(users.telegramUserId, telegramUserId),
    columns: { id: true, name: true, isActive: true },
  })
  if (!user) return { prepared: true, reason: 'user_not_found' as const }
  if (user.isActive) return { prepared: true, reason: 'already_active' as const }

  const [membership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id))
    .limit(1)
  // член команды платформы (29.3.1) — не smoke-аккаунт, сколько бы ни совпадало имя
  const [staff] = await db
    .select({ userId: platformStaff.userId })
    .from(platformStaff)
    .where(eq(platformStaff.userId, user.id))
  if (staff || membership || user.name !== SMOKE_NAME) {
    return { prepared: false, reason: 'not_smoke_account' as const }
  }

  // Условие в UPDATE повторяет проверки: гонка с блокировкой root не включит чужого
  const updated = await db
    .update(users)
    .set({ isActive: true })
    .where(
      and(
        eq(users.id, user.id),
        eq(users.name, SMOKE_NAME),
        sql`NOT EXISTS (SELECT 1 FROM ${platformStaff} ps WHERE ps.user_id = ${users.id})`,
      ),
    )
    .returning({ id: users.id })
  if (!updated.length) return { prepared: false, reason: 'not_smoke_account' as const }
  return { prepared: true, reason: 'reenabled' as const, userId: user.id }
})
