---
id: '3.3.3'
phase: '3'
epic: '3.3'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - BACK
  - SECURITY
depends_on:
  - '3.3.1'
estimated_hours: '2-3'
tags:
  - auth
  - telegram
  - security
  - hmac
---

# Task 3.3.3: Telegram identity через initData HMAC валидация

## Цель

Реализовать Telegram identity provider: пользователь открывает Mini App из бота с `initData` в URL, сервер валидирует HMAC через bot token, создаёт/находит User, открывает сессию.

## Контекст

Это **критически важный security-узел**. Если HMAC валидация делается неправильно, любой может зайти под чужим именем.

Алгоритм валидации описан в [официальной документации Telegram WebApps](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):

1. Получить `init_data` — query-string от Telegram (передаётся в `window.Telegram.WebApp.initData`)
2. Распарсить как `URLSearchParams`
3. Извлечь `hash`, остальные параметры отсортировать по ключам, склеить в строку `key=value\nkey=value...`
4. Вычислить `secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)`
5. Вычислить `data_check_string` hash через `HMAC_SHA256(key=secret_key, message=data_check_string)`
6. Сравнить с предоставленным hash
7. Дополнительно проверить, что `auth_date` не старше N минут (защита от replay)

## Что должно быть сделано

1. **`packages/auth/src/telegram/validate.ts`:**

   ```ts
   import { createHmac } from 'node:crypto'

   export interface ValidatedInitData {
     user: {
       id: bigint
       first_name: string
       last_name?: string
       username?: string
       language_code?: string
       photo_url?: string
     }
     auth_date: number
     chat_instance?: string
     start_param?: string
   }

   export class TelegramAuthError extends Error {}

   export function validateInitData(
     initDataRaw: string,
     botToken: string,
     options: { maxAgeSeconds?: number } = {},
   ): ValidatedInitData {
     const maxAgeSeconds = options.maxAgeSeconds ?? 24 * 60 * 60 // 24h по умолчанию

     const params = new URLSearchParams(initDataRaw)
     const hash = params.get('hash')
     if (!hash) throw new TelegramAuthError('Missing hash in initData')

     params.delete('hash')

     // Сортируем и склеиваем
     const dataCheckString = Array.from(params.entries())
       .map(([k, v]) => `${k}=${v}`)
       .sort()
       .join('\n')

     // Computing HMAC
     const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
     const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

     if (computedHash !== hash) {
       throw new TelegramAuthError('Invalid initData signature')
     }

     // Auth date check
     const authDate = Number(params.get('auth_date'))
     if (!authDate || Number.isNaN(authDate)) {
       throw new TelegramAuthError('Missing or invalid auth_date')
     }
     const ageSeconds = Math.floor(Date.now() / 1000) - authDate
     if (ageSeconds > maxAgeSeconds) {
       throw new TelegramAuthError(`initData expired (age: ${ageSeconds}s, max: ${maxAgeSeconds}s)`)
     }

     // Parse user
     const userJson = params.get('user')
     if (!userJson) throw new TelegramAuthError('Missing user in initData')
     const user = JSON.parse(userJson)
     if (!user.id) throw new TelegramAuthError('Missing user.id')

     return {
       user: {
         id: BigInt(user.id),
         first_name: user.first_name,
         last_name: user.last_name,
         username: user.username,
         language_code: user.language_code,
         photo_url: user.photo_url,
       },
       auth_date: authDate,
       chat_instance: params.get('chat_instance') ?? undefined,
       start_param: params.get('start_param') ?? undefined,
     }
   }
   ```

2. **`packages/auth/src/telegram/handler.ts`** — обработчик создания/привязки User:

   ```ts
   import { db, users, accounts } from '@volley-time/db'
   import { eq, and } from 'drizzle-orm'
   import { validateInitData, type ValidatedInitData } from './validate'

   export async function authenticateViaTelegram(
     initDataRaw: string,
     botToken: string,
   ): Promise<{ userId: number; isNewUser: boolean }> {
     const data = validateInitData(initDataRaw, botToken)
     const tgUserId = data.user.id

     // Сначала ищем по telegram_user_id
     let user = await db.query.users.findFirst({
       where: eq(users.telegramUserId, tgUserId),
     })

     if (user) {
       // Update telegram metadata
       await db
         .update(users)
         .set({
           telegramUsername: data.user.username,
           name: user.name ?? `${data.user.first_name} ${data.user.last_name ?? ''}`.trim(),
           updatedAt: new Date(),
         })
         .where(eq(users.id, user.id))
       return { userId: user.id, isNewUser: false }
     }

     // Создаём нового user
     const [newUser] = await db
       .insert(users)
       .values({
         telegramUserId: tgUserId,
         telegramUsername: data.user.username,
         name:
           `${data.user.first_name} ${data.user.last_name ?? ''}`.trim() ||
           data.user.username ||
           'User',
       })
       .returning()

     if (!newUser) throw new Error('Failed to create user')

     // Создаём account
     await db.insert(accounts).values({
       userId: newUser.id,
       providerId: 'telegram',
       accountId: String(tgUserId),
     })

     return { userId: newUser.id, isNewUser: true }
   }
   ```

3. **`packages/auth/src/telegram/index.ts`:**

   ```ts
   export { validateInitData, TelegramAuthError } from './validate'
   export type { ValidatedInitData } from './validate'
   export { authenticateViaTelegram } from './handler'
   ```

4. **Подключение в better-auth `config.ts`:**
   - Зарегистрировать кастомный endpoint `POST /api/auth/telegram` (через better-auth plugin API)
   - Endpoint принимает `{ initData }`, валидирует, создаёт session через better-auth session API

## Критерии приёмки

- ✅ Валидный `initData` (с правильным HMAC и свежим auth_date) → `validateInitData` возвращает parsed data
- ✅ Невалидный hash → `TelegramAuthError('Invalid initData signature')`
- ✅ Tampered data (изменил поле, hash не пересчитывал) → ошибка
- ✅ Старый `auth_date` (>24h) → `TelegramAuthError('initData expired')`
- ✅ Missing hash → ошибка
- ✅ `authenticateViaTelegram` создаёт User + Account при первом входе
- ✅ Повторный вход того же Telegram-пользователя — находит существующего User, не создаёт дубль
- ✅ Unit-тест с known-good fixture (тестовый initData + token + ожидаемый hash)

## Подсказки

- **Тестовый initData** — можно сгенерировать программно: взять любой bot token, рассчитать HMAC для тестовых данных, использовать в тестах.
- **Не используй timing-unsafe сравнение** для hash: используй `crypto.timingSafeEqual` если боишься timing attacks (для нашего масштаба — overkill, но bonus points).
- **Сохраняй last_seen_at** для Telegram user — это полезно для CRM позже, но в Phase 3 не нужно.
- **Race condition при первом входе одного user из двух tabs**: возможно одновременное создание дублей. Решение: unique constraint на `users.telegram_user_id` — второй INSERT упадёт с ошибкой, обработай её через find-then-create-or-find паттерн.

## Не делать

- ❌ Не складывать `auth_date` без проверки — это критическое security-окно
- ❌ Не доверять полям `first_name`, `username` без валидации (могут быть пустыми)
- ❌ Не пытаться валидировать через bot API (это медленно и не нужно) — HMAC достаточно
- ❌ Не использовать `Telegram.WebApp.initDataUnsafe` на сервере (только клиент-side hint)
- ❌ Не пересылать `bot_token` на клиент — только сервер знает его
