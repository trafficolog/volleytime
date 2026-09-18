---
id: '10.2.1'
phase: '10'
epic: '10.2'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
depends_on:
  - '8.4.1'
estimated_hours: '1-2'
tags:
  - beta
  - feedback
  - telegram
---

# Task 10.2.1: Feedback endpoint + отправка в служебный канал

## Цель

Endpoint приёма обратной связи из Mini App → отправка в служебный Telegram-канал (через bot). Контекст для триажа.

## Контекст

Решение 4: кнопка в Mini App → служебный канал. Переиспользует bot transport (8.4.1) или отдельную отправку в служебный chat_id.

## Что должно быть сделано

1. **Endpoint `apps/web/server/api/feedback.post.ts`:**

   ```ts
   import { z } from 'zod'
   import { requireAuth } from '~/modules/permissions' // любой залогиненный
   import { sendToServiceChannel } from '~/modules/beta/feedback'

   const FeedbackInput = z.object({
     text: z.string().min(1).max(2000),
     context: z
       .object({
         screen: z.string().optional(),
         orgId: z.number().optional(),
       })
       .optional(),
   })

   export default defineEventHandler(async (event) => {
     const session = await requireAuth(event)
     const body = FeedbackInput.parse(await readBody(event))

     await sendToServiceChannel({
       userId: session.userId,
       userName: session.userName,
       text: body.text,
       screen: body.context?.screen,
       orgId: body.context?.orgId,
     })
     return { ok: true }
   })
   ```

2. **sendToServiceChannel** (modules/beta/feedback.ts) — отправка в служебный chat:

   ```ts
   // через bot internal transport (8.4.1) или прямой вызов
   export async function sendToServiceChannel(fb: {
     userId: number
     userName: string
     text: string
     screen?: string
     orgId?: number
   }) {
     const config = useRuntimeConfig()
     const message =
       `📨 <b>Обратная связь</b>\n` +
       `От: ${esc(fb.userName)} (id ${fb.userId})\n` +
       (fb.screen ? `Экран: ${esc(fb.screen)}\n` : '') +
       (fb.orgId ? `Орг: ${fb.orgId}\n` : '') +
       `\n${esc(fb.text)}`

     // отправка в служебный chat (FEEDBACK_CHAT_ID) через bot internal transport
     await $fetch(`${config.botInternalUrl}/internal/notify`, {
       method: 'POST',
       headers: { 'x-internal-secret': config.botInternalSecret },
       body: { telegramId: config.feedbackChatId, text: message },
       timeout: 5000,
     })
   }
   ```

3. **Служебный канал/чат:** FEEDBACK_CHAT_ID (env) — telegram chat_id служебного канала/группы беты, куда падают репорты. Бот должен быть участником.

4. **Контекст:** screen (текущий экран — фронт передаёт), orgId, userName — для триажа (понять где/кто).

5. **Rate limit (опц):** простая защита от спама (N в минуту на пользователя).

6. **Тесты:**
   ```ts
   test('feedback sends to service channel with context', async () => {})
   test('requires auth', async () => {})
   test('validates text length', async () => {})
   ```

## Критерии приёмки

- ✅ POST /api/feedback (требует auth)
- ✅ Валидация (text 1-2000, опц context)
- ✅ Отправка в служебный канал (FEEDBACK_CHAT_ID) через bot
- ✅ Контекст: userName, userId, screen, orgId
- ✅ HTML экранирование
- ✅ Подтверждение { ok: true }
- ✅ Тесты

## Подсказки

- **Переиспользуем bot transport (8.4.1)** — internal notify endpoint уже шлёт сообщения через bot. feedback → служебный chat_id вместо пользователя.
- **FEEDBACK_CHAT_ID** — служебная группа беты (ты + опц команда). Бот добавлен туда. Репорты падают сразу в Telegram.
- **screen context** — фронт (10.2.2) передаёт текущий route. Помогает понять где проблема.
- **esc** — обратная связь от пользователей, экранировать для HTML parse_mode.

## Не делать

- ❌ Не делать тикет-систему (служебный чат)
- ❌ Не собирать лишний PII
- ❌ Не слать без auth (спам)
