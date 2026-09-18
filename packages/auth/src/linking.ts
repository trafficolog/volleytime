import { accounts, db, eq, users } from '@volley-time/db'

import { validateInitData } from './telegram/validate'

export class AccountAlreadyLinkedError extends Error {
  override name = 'AccountAlreadyLinkedError'
}
export class AccountLinkedToOtherUserError extends Error {
  override name = 'AccountLinkedToOtherUserError'
}

/**
 * Привязать Telegram-идентичность к существующему User.
 * Валидирует initData (HMAC), НЕ создаёт нового пользователя.
 * Бросает если Telegram уже привязан к другому/этому User.
 */
export async function linkTelegramToUser(
  userId: number,
  initDataRaw: string,
  botToken: string,
): Promise<{ linkedTelegramId: bigint }> {
  const data = validateInitData(initDataRaw, botToken)
  const tgUserId = data.user.id

  const existingByTg = await db.query.users.findFirst({
    where: eq(users.telegramUserId, tgUserId),
  })
  if (existingByTg && existingByTg.id !== userId) {
    throw new AccountLinkedToOtherUserError('Этот Telegram уже привязан к другому аккаунту')
  }

  const currentUser = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (currentUser?.telegramUserId === tgUserId) {
    throw new AccountAlreadyLinkedError('Этот Telegram уже привязан к вашему аккаунту')
  }
  if (currentUser?.telegramUserId && currentUser.telegramUserId !== tgUserId) {
    throw new AccountAlreadyLinkedError(
      'К аккаунту уже привязан другой Telegram — сначала отвяжите его',
    )
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        telegramUserId: tgUserId,
        telegramUsername: data.user.username ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    await tx.insert(accounts).values({
      userId,
      providerId: 'telegram',
      accountId: String(tgUserId),
    })
  })

  return { linkedTelegramId: tgUserId }
}
