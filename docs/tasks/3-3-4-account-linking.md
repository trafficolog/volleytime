---
id: '3.3.4'
phase: '3'
epic: '3.3'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - BACK
depends_on:
  - '3.3.1'
  - '3.3.3'
estimated_hours: '1-2'
tags:
  - auth
  - account-linking
---

# Task 3.3.4: Account linking (email + Telegram)

## Цель

Реализовать связывание двух identity у одного User: пользователь, авторизованный через email, может привязать Telegram. И наоборот.

## Контекст

Решение из phase-card: **equal identity model**. И email, и Telegram создают User независимо. Связывание происходит через UI authentic'd-пользователя.

Сценарии:

1. **Email-first:** User зарегистрирован email → в settings жмёт «Привязать Telegram» → открывается deeplink в боте → бот валидирует initData → создаёт Account record для существующего User
2. **Telegram-first:** User пришёл из бота → в settings вводит email → код приходит → подтверждение → User уже существует (с Telegram), добавляется email + Account record

## Что должно быть сделано

1. **API endpoint `POST /api/auth/link/telegram`** (в apps/web/server):

   ```ts
   // apps/web/server/api/auth/link/telegram.post.ts
   import { auth } from '@volley-time/auth'
   import { authenticateViaTelegram } from '@volley-time/auth/telegram'

   export default defineEventHandler(async (event) => {
     const session = await auth.api.getSession({ headers: event.node.req.headers })
     if (!session) throw createError({ statusCode: 401 })

     const body = await readBody<{ initData: string }>(event)
     const botToken = useRuntimeConfig().telegramBotToken

     // Validate, but don't auto-create
     const result = await linkTelegramToUser(session.user.id, body.initData, botToken)
     return { success: true, ...result }
   })
   ```

2. **`packages/auth/src/linking.ts`:**

   ```ts
   import { db, users, accounts } from '@volley-time/db'
   import { eq, and } from 'drizzle-orm'
   import { validateInitData } from './telegram'

   export class AccountAlreadyLinkedError extends Error {}
   export class AccountLinkedToOtherUserError extends Error {}

   export async function linkTelegramToUser(
     userId: number,
     initDataRaw: string,
     botToken: string,
   ): Promise<{ linkedTelegramId: bigint }> {
     const data = validateInitData(initDataRaw, botToken)
     const tgUserId = data.user.id

     // Проверка: этот Telegram уже привязан к другому User?
     const existingByTg = await db.query.users.findFirst({
       where: eq(users.telegramUserId, tgUserId),
     })

     if (existingByTg && existingByTg.id !== userId) {
       throw new AccountLinkedToOtherUserError(
         `Telegram account already linked to user ${existingByTg.id}`,
       )
     }

     // Проверка: у текущего User уже есть Telegram?
     const currentUser = await db.query.users.findFirst({
       where: eq(users.id, userId),
     })

     if (currentUser?.telegramUserId === tgUserId) {
       throw new AccountAlreadyLinkedError('Telegram already linked to this user')
     }
     if (currentUser?.telegramUserId && currentUser.telegramUserId !== tgUserId) {
       throw new AccountAlreadyLinkedError('User has different Telegram linked; unlink first')
     }

     // Связываем
     await db.transaction(async (tx) => {
       await tx
         .update(users)
         .set({
           telegramUserId: tgUserId,
           telegramUsername: data.user.username,
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
   ```

3. **Связывание email с Telegram-first User** — обычный flow better-auth `sendCode` + `verifyCode`. Когда пользователь верифицирует email, он уже authenticated через Telegram → email просто добавляется к существующему User. Это работает «из коробки» better-auth (если правильно настроено account-linking), нужно проверить.

4. **API endpoint `POST /api/auth/unlink/telegram`** (опционально, для полноты):

   ```ts
   // unlinks but requires at least one identity remaining
   ```

   В Phase 3 — не реализуем. Только linking.

5. **Тесты:**
   - Link Telegram к email-user: успех, accounts table содержит 2 записи
   - Link Telegram уже привязанный к другому User: `AccountLinkedToOtherUserError`
   - Re-link того же Telegram: `AccountAlreadyLinkedError`
   - User с двумя identity может зайти любой из них и попасть в тот же account

## Критерии приёмки

- ✅ User с email может привязать Telegram через `/api/auth/link/telegram` с initData
- ✅ После привязки: `users.telegram_user_id` заполнен, `accounts` содержит запись `(providerId: telegram, accountId: <id>)`
- ✅ Login через любой identity (email-code ИЛИ Telegram) ведёт на одного и того же User
- ✅ Попытка привязать чужой Telegram → 409 Conflict
- ✅ Transaction atomicity: если что-то падает между update users и insert accounts — оба роллбекаются

## Подсказки

- **Better-auth account linking:** проверь, как better-auth API делает linking «из коробки». Возможно, не придётся писать всё вручную.
- **Идемпотентность:** если случайно вызвать link дважды с тем же initData — должно быть либо success (no-op), либо ясная ошибка.
- **Логирование:** все попытки linking стоит писать в audit log (Phase 4), но в Phase 3 — просто `console.log` достаточно.

## Не делать

- ❌ Не делать unlinking в Phase 3 (можно потом)
- ❌ Не реализовывать merge двух существующих accounts (сложный edge case — после Phase 10)
- ❌ Не отправлять email-уведомление о новом linked identity — это спам в MVP
- ❌ Не делать UI для linking в Phase 3 — только API (UI добавится в Phase 4 настройках пользователя)
