---
id: '8.4.1'
phase: '8'
epic: '8.4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 8.8.'
roles:
  - BACK
depends_on:
  - '8.1.2'
  - '3.5.1'
estimated_hours: '2'
tags:
  - notifier
  - telegram
  - architecture
---

# Task 8.4.1: NotifierService + internal transport (web→bot)

## Цель

NotifierService в web (резолвит telegram_id, шлёт боту). Internal HTTP endpoint в боте (принимает запрос, отправляет через grammY). Защита shared secret. Fire-and-forget.

## Контекст

web и bot — раздельные процессы. grammY живёт в боте. Web→bot транспорт: internal HTTP. Решение 7: fire-and-forget после коммита.

## Что должно быть сделано

1. **Модуль `apps/web/modules/notifier/`** (service, transport, errors, index).

2. **`transport.ts`** — отправка боту:

   ```ts
   interface NotifyPayload {
     telegramId: string
     text: string
     keyboard?: { text: string; url?: string; webAppUrl?: string }[][]
   }

   export async function sendToBot(payload: NotifyPayload): Promise<void> {
     const config = useRuntimeConfig()
     const botInternalUrl = config.botInternalUrl // напр. http://bot:3001/internal/notify
     const secret = config.botInternalSecret

     await $fetch(`${botInternalUrl}/internal/notify`, {
       method: 'POST',
       headers: { 'x-internal-secret': secret },
       body: payload,
       // таймаут, чтобы медленный бот не висел
       timeout: 5000,
     })
   }
   ```

3. **`service.ts` — NotifierService:**

   ```ts
   import { db, users } from '@volley-time/db'
   import { eq } from 'drizzle-orm'
   import { sendToBot } from './transport'
   import { renderMessage, type NotificationType } from './templates'

   export const notifierService = {
     /**
      * Отправить уведомление пользователю.
      * Fire-and-forget: ошибки логируются, НЕ пробрасываются.
      * Вызывать ПОСЛЕ коммита транзакции (не внутри).
      */
     async send(
       userId: number,
       type: NotificationType,
       payload: Record<string, unknown>,
     ): Promise<void> {
       try {
         const user = await db.query.users.findFirst({
           where: eq(users.id, userId),
           columns: { id: true, telegramId: true },
         })
         if (!user?.telegramId) {
           // нет telegram — пропускаем (не ошибка)
           return
         }

         const message = renderMessage(type, payload)
         await sendToBot({
           telegramId: user.telegramId,
           text: message.text,
           keyboard: message.keyboard,
         })
       } catch (e) {
         console.error(`[notifier] failed to send ${type} to user ${userId}`, e)
         // НЕ пробрасываем — fire-and-forget
       }
     },

     /**
      * Массовая отправка (для event cancelled — всем участникам).
      */
     async sendMany(
       userIds: number[],
       type: NotificationType,
       payload: Record<string, unknown>,
     ): Promise<void> {
       await Promise.allSettled(userIds.map((id) => this.send(id, type, payload)))
     },
   }
   ```

4. **Internal endpoint в боте `apps/bot/src/server/notify.ts`** (бот поднимает мини HTTP-сервер или endpoint):

   ```ts
   import { InlineKeyboard } from 'grammy'
   import { env } from '../env'
   import { bot } from '../bot'

   // Простой HTTP listener (h3/node http) на отдельном порту
   export function handleNotify(payload: {
     telegramId: string
     text: string
     keyboard?: { text: string; url?: string; webAppUrl?: string }[][]
   }) {
     let replyMarkup: InlineKeyboard | undefined
     if (payload.keyboard) {
       replyMarkup = new InlineKeyboard()
       for (const row of payload.keyboard) {
         for (const btn of row) {
           if (btn.webAppUrl) replyMarkup.webApp(btn.text, btn.webAppUrl)
           else if (btn.url) replyMarkup.url(btn.text, btn.url)
         }
         replyMarkup.row()
       }
     }
     return bot.api.sendMessage(payload.telegramId, payload.text, {
       parse_mode: 'HTML',
       reply_markup: replyMarkup,
     })
   }
   ```

   Endpoint проверяет `x-internal-secret`, вызывает handleNotify. Слушает на internal-порту (не публичном).

5. **Защита internal endpoint:**

   ```ts
   // в bot http handler:
   if (req.headers['x-internal-secret'] !== env.BOT_INTERNAL_SECRET) {
     res.statusCode = 403
     res.end('Forbidden')
     return
   }
   ```

6. **Конфиг** — добавить в env web и bot: BOT_INTERNAL_URL, BOT_INTERNAL_SECRET.

7. **Тесты:**
   ```ts
   test('send skips user without telegramId', async () => {})
   test('send resolves telegramId and calls transport', async () => {})
   test('send swallows transport errors (fire-and-forget)', async () => {})
   test('sendMany sends to all, isolates failures', async () => {})
   test('internal endpoint rejects wrong secret', async () => {})
   ```

## Критерии приёмки

- ✅ NotifierService.send: резолвит telegram_id, рендерит, шлёт боту
- ✅ Пользователь без telegram_id → пропуск (не ошибка)
- ✅ Fire-and-forget: ошибки транспорта логируются, не пробрасываются
- ✅ sendMany: всем, изоляция сбоев (Promise.allSettled)
- ✅ Internal endpoint бота: принимает {telegramId, text, keyboard}, шлёт через grammY
- ✅ Защита secret (403 при неверном)
- ✅ Таймаут транспорта (медленный бот не висит)
- ✅ Тесты: skip/resolve/swallow/sendMany/secret

## Подсказки

- **Раздельные процессы** — главная причина internal HTTP. Альтернатива (общий grammY в монорепо) хрупка при раздельном деплое (Phase 9). HTTP проще и надёжнее.
- **Internal endpoint НЕ публичный** — отдельный порт/путь, защита secret. В Phase 9 (deploy) — за firewall/internal network.
- **Fire-and-forget строго** — notifier не должен ронять бизнес-логику. Любая ошибка → лог, не throw.
- **Таймаут** — если бот тормозит, web не должен висеть. 5 сек достаточно.
- **HTML parse_mode** — для форматирования (жирный заголовок). Экранировать пользовательские данные.

## Не делать

- ❌ Не вызывать внутри транзакции (после коммита)
- ❌ Не пробрасывать ошибки доставки
- ❌ Не делать публичным internal endpoint
- ❌ Не делать retry/очередь — Phase 15
