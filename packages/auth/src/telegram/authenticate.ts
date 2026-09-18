import { accounts, db, eq, users } from '@volley-time/db'

import { validateInitData } from './validate'

export interface TelegramAuthResult {
  userId: number
  isNewUser: boolean
}

/**
 * Аутентификация через Telegram Mini App initData.
 * Валидирует подпись, находит User по telegram_user_id или создаёт нового.
 * НЕ создаёт сессию — это делает вызывающий (better-auth).
 */
export async function authenticateViaTelegram(
  initDataRaw: string,
  botToken: string,
): Promise<TelegramAuthResult> {
  const data = validateInitData(initDataRaw, botToken)
  const tg = data.user

  const existing = await db.query.users.findFirst({
    where: eq(users.telegramUserId, tg.id),
  })
  if (existing) {
    return { userId: existing.id, isNewUser: false }
  }

  // авто-создание из Telegram-данных (Mini App аутентифицировал)
  const name = [tg.first_name, tg.last_name].filter(Boolean).join(' ') || null
  const userId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        telegramUserId: tg.id,
        telegramUsername: tg.username ?? null,
        name,
        image: tg.photo_url ?? null,
      })
      .returning()
    if (!created) throw new Error('Failed to create user')

    await tx.insert(accounts).values({
      userId: created.id,
      providerId: 'telegram',
      accountId: String(tg.id),
    })
    return created.id
  })

  return { userId, isNewUser: true }
}
