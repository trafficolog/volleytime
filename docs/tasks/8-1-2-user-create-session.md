---
id: '8.1.2'
phase: '8'
epic: '8.1'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 8.8.'
roles:
  - BACK
depends_on:
  - '8.1.1'
  - '3.3.4'
estimated_hours: '2'
tags:
  - telegram
  - auth
  - users
---

# Task 8.1.2: Авто-создание/связывание User + сессия

## Цель

После валидации initData: найти User по telegram_id или создать нового (из Telegram-данных), выдать сессию better-auth.

## Контекст

Решение 4: авто-создание User без формы. Phase 3 (3.3.3 telegram identity, 3.3.4 account linking) заложил связь User ↔ Telegram. Здесь — рабочий flow создания/поиска + сессия.

## Что должно быть сделано

1. **Расширить endpoint `telegram-miniapp.post.ts`** (из 8.1.1):

   ```ts
   import { validateInitData } from '~/server/utils/telegram-initdata'
   import { db, users, accounts } from '@volley-time/db'
   import { eq, and } from 'drizzle-orm'
   import { auth } from '@volley-time/auth'

   export default defineEventHandler(async (event) => {
     const body = await readBody(event)
     const initData = body?.initData
     if (!initData) throw createError({ statusCode: 400, statusMessage: 'initData required' })

     const botToken = useRuntimeConfig().telegramBotToken
     const validated = validateInitData(initData, botToken)
     if (!validated?.user) throw createError({ statusCode: 401, statusMessage: 'Invalid initData' })

     const tg = validated.user
     const user = await findOrCreateTelegramUser(tg)

     // Создать сессию better-auth для этого user
     const session = await createSessionForUser(event, user.id)

     return { user: { id: user.id, name: user.name, telegramUsername: user.telegramUsername } }
   })
   ```

2. **findOrCreateTelegramUser** — логика поиска/создания:

   ```ts
   async function findOrCreateTelegramUser(tg: {
     id: number
     first_name: string
     last_name?: string
     username?: string
     photo_url?: string
   }) {
     // Telegram identity хранится как account (provider='telegram', accountId=tg.id)
     // см. 3.3.3 / 3.3.4 — паттерн account linking
     const existing = await db.query.accounts.findFirst({
       where: and(eq(accounts.providerId, 'telegram'), eq(accounts.accountId, String(tg.id))),
       with: { user: true },
     })
     if (existing?.user) return existing.user

     // Новый user
     const name = [tg.first_name, tg.last_name].filter(Boolean).join(' ')
     const [user] = await db
       .insert(users)
       .values({
         name,
         email: null, // email опционально, добавит позже
         telegramId: String(tg.id),
         telegramUsername: tg.username ?? null,
         image: tg.photo_url ?? null,
       })
       .returning()

     // Создать account-связь
     await db.insert(accounts).values({
       userId: user!.id,
       providerId: 'telegram',
       accountId: String(tg.id),
     })

     return user!
   }
   ```

   (точные имена полей users/accounts — из схемы Phase 3; адаптировать)

3. **createSessionForUser** — выдать сессию better-auth:

   ```ts
   // better-auth API для программного создания сессии.
   // Зависит от версии better-auth. Варианты:
   //  - auth.api.signInWithCredential / createSession (если поддерживается)
   //  - ручное создание session записи + установка cookie
   async function createSessionForUser(event: H3Event, userId: number) {
     // Использовать better-auth механизм создания сессии.
     // Если прямого API нет — создать session запись в БД (как делает better-auth)
     // и установить session cookie через setCookie.
     // Детали зависят от 3.3.1 (better-auth base config).
     // ВАЖНО: сессия должна быть совместима с middleware (4.5.1 getSession).
   }
   ```

   Реализация зависит от того, как настроен better-auth в 3.3.1. Если better-auth поддерживает custom credential provider — зарегистрировать telegram как provider. Иначе — программно создать session + cookie совместимо с better-auth схемой.

4. **Тесты:**
   ```ts
   test('new telegram user → user created with telegram fields', async () => {})
   test('existing telegram user → found, not duplicated', async () => {})
   test('user name from first_name + last_name', async () => {})
   test('email null for telegram-created user', async () => {})
   test('session created after auth', async () => {})
   ```

## Критерии приёмки

- ✅ Новый Telegram-пользователь → User создан (name, telegram_id, username, image)
- ✅ Существующий (по telegram account) → найден, не дублируется
- ✅ email = null для Telegram-созданных
- ✅ account-связь (provider=telegram) создаётся
- ✅ Сессия better-auth выдаётся (совместима с middleware 4.5.1)
- ✅ Endpoint возвращает user данные
- ✅ Тесты: create/find/no-duplicate/session

## Подсказки

- **Account linking паттерн** из 3.3.3/3.3.4 — Telegram как provider в accounts таблице. Переиспользуем.
- **createSession зависит от better-auth (3.3.1).** Это самое тонкое место. Если better-auth даёт API для создания сессии по userId — использовать. Иначе — изучить как better-auth хранит сессии и создать совместимо. Сессия ДОЛЖНА читаться через auth.api.getSession (которым пользуется tenant middleware 4.5.1).
- **photo_url из Telegram** — аватар, опционально сохранить в user.image.
- **Если у существующего user уже есть email-аккаунт** — account linking (3.3.4) может связать telegram с тем же user. В MVP — telegram_id основной ключ для Mini App.

## Не делать

- ❌ Не требовать email при создании
- ❌ Не дублировать user при повторном входе
- ❌ Не создавать сессию несовместимую с better-auth middleware
- ❌ Не хранить initData
