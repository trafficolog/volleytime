import { accounts, db, eq, users } from '@volley-time/db'

import { validateLoginWidgetData } from './login-widget'
import { validateInitData, type ValidatedTelegramUser } from './validate'

export interface TelegramAuthResult {
  userId: number
  isNewUser: boolean
}

export interface TelegramAuthOptions {
  /** Срок жизни подписанных данных; по умолчанию — дефолт валидатора. */
  maxAgeSeconds?: number
}

async function findTelegramUserId(telegramUserId: bigint): Promise<number | undefined> {
  const existing = await db.query.users.findFirst({
    where: eq(users.telegramUserId, telegramUserId),
  })
  return existing?.id
}

/**
 * Найти User по подтверждённой Telegram-личности или создать нового (equal identity, 3.3.4).
 * Mini App и Login Widget сходятся сюда: один telegram_user_id — один User.
 * Первый вход гонками (два запроса одновременно) не падает: проигравший вставку
 * (`ON CONFLICT DO NOTHING` по уникальному telegram_user_id) перечитывает победителя.
 */
async function findOrCreateTelegramUser(tg: ValidatedTelegramUser): Promise<TelegramAuthResult> {
  const existingId = await findTelegramUserId(tg.id)
  if (existingId !== undefined) return { userId: existingId, isNewUser: false }

  const name = [tg.first_name, tg.last_name].filter(Boolean).join(' ') || null
  const createdId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        telegramUserId: tg.id,
        telegramUsername: tg.username ?? null,
        name,
        image: tg.photo_url ?? null,
      })
      .onConflictDoNothing({ target: users.telegramUserId })
      .returning()
    if (!created) return undefined // другой запрос создал пользователя раньше

    await tx.insert(accounts).values({
      userId: created.id,
      providerId: 'telegram',
      accountId: String(tg.id),
    })
    return created.id
  })
  if (createdId !== undefined) return { userId: createdId, isNewUser: true }

  // ON CONFLICT ждёт коммита конкурента, поэтому его строка уже видна
  const winnerId = await findTelegramUserId(tg.id)
  if (winnerId === undefined) throw new Error('Telegram user vanished after a concurrent insert')
  return { userId: winnerId, isNewUser: false }
}

/**
 * Аутентификация через Telegram Mini App initData.
 * Валидирует подпись и срок жизни, находит User по telegram_user_id или создаёт нового.
 * НЕ создаёт сессию — это делает вызывающий (better-auth).
 */
export async function authenticateViaTelegram(
  initDataRaw: string,
  botToken: string,
  options: TelegramAuthOptions = {},
): Promise<TelegramAuthResult> {
  const data = validateInitData(initDataRaw, botToken, options)
  return findOrCreateTelegramUser(data.user)
}

/** Аутентификация через Telegram Login Widget (веб, D-05). Сессию создаёт вызывающий. */
export async function authenticateViaLoginWidget(
  payload: unknown,
  botToken: string,
  options: TelegramAuthOptions = {},
): Promise<TelegramAuthResult> {
  const data = validateLoginWidgetData(payload, botToken, options)
  return findOrCreateTelegramUser(data.user)
}
