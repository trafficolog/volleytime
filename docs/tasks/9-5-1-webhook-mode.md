---
id: '9.5.1'
phase: '9'
epic: '9.5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'Webhook implementation and secret protection are deployed, but Telegram IPv4 ingress never reaches the VPS; production uses polling and webhook delivery acceptance remains open.'
roles:
  - BACK
  - DEVOPS
depends_on:
  - '3.5.1'
estimated_hours: '1-2'
tags:
  - telegram
  - webhook
  - bot
---

# Task 9.5.1: Webhook режим + setWebhook + secret защита

## Цель

Переключить бота на webhook (production): grammY webhook listener, setWebhook при старте с secret_token, проверка X-Telegram-Bot-Api-Secret-Token. Long-polling сохранить для dev.

## Контекст

Решение 3: webhook на /tg/webhook/<secret>, secret_token защита. Phase 3 (3.5.1) — long-polling. Production: Telegram шлёт updates на HTTPS endpoint через Caddy (9.2.2).

## Что должно быть сделано

1. **Webhook listener в боте** (grammY webhookCallback):

   ```ts
   import { webhookCallback } from 'grammy'
   import { createServer } from 'node:http'
   import { bot } from './bot'
   import { env } from './env'

   // grammY даёт webhookCallback для разных фреймворков; для node http:
   const handleUpdate = webhookCallback(bot, 'http', {
     secretToken: env.WEBHOOK_SECRET_TOKEN, // проверка X-Telegram-Bot-Api-Secret-Token
   })

   export function startWebhookServer() {
     const server = createServer(async (req, res) => {
       // Caddy срезал /tg/webhook/<path>, сюда приходит корень
       if (req.method === 'POST') {
         try {
           await handleUpdate(req, res)
         } catch (e) {
           console.error('[webhook] error', e)
           res.statusCode = 500
           res.end()
         }
       } else {
         res.statusCode = 404
         res.end()
       }
     })
     server.listen(8443, () => console.log('[bot] webhook listening :8443'))
   }
   ```

2. **setWebhook при старте:**

   ```ts
   async function registerWebhook() {
     await bot.api.setWebhook(env.WEBHOOK_URL, {
       secret_token: env.WEBHOOK_SECRET_TOKEN,
       drop_pending_updates: true, // не обрабатывать накопленное при переключении
     })
     console.log('[bot] webhook registered:', env.WEBHOOK_URL)
   }
   ```

3. **Env-переключение polling/webhook** `apps/bot/src/index.ts`:

   ```ts
   if (env.BOT_MODE === 'webhook') {
     await registerWebhook()
     startWebhookServer()
     startInternalNotifyServer() // 9.5.2
   } else {
     // dev: long-polling (3.5.1)
     await bot.api.deleteWebhook() // убрать webhook если был
     bot.start()
   }
   ```

4. **secret_token vs secret path:** двойная защита:
   - Caddy путь `/tg/webhook/<WEBHOOK_SECRET_PATH>` (никто не знает URL)
   - Telegram secret_token заголовок (grammY проверяет X-Telegram-Bot-Api-Secret-Token)
     Разные секреты.

5. **Env:** BOT_MODE, WEBHOOK_URL, WEBHOOK_SECRET_TOKEN, WEBHOOK_SECRET_PATH (для Caddy).

6. **Проверка:** после setWebhook бот получает updates через Caddy, отвечает. `getWebhookInfo` показывает URL без ошибок.

## Критерии приёмки

- ✅ Webhook listener (grammY webhookCallback, :8443)
- ✅ setWebhook при старте (URL + secret_token, drop_pending)
- ✅ secret_token проверяется (X-Telegram-Bot-Api-Secret-Token)
- ✅ Caddy секретный путь + secret_token = двойная защита
- ✅ BOT_MODE=webhook (prod) / polling (dev) переключение
- ✅ dev long-polling не сломан
- ✅ Бот отвечает на updates через webhook
- ✅ getWebhookInfo без ошибок

## Подсказки

- **Двойная защита:** секретный путь (Caddy) скрывает URL, secret_token проверяет что это Telegram. Без secret_token любой, узнавший URL, шлёт фейк-updates.
- **drop_pending_updates: true** при переключении — не обрабатывать накопленное за время простоя (иначе всплеск старых).
- **Caddy handle_path срезает префикс** (9.2.2) — webhookCallback получает чистый POST. Учесть.
- **deleteWebhook в dev** — если переключаешься на polling, убрать webhook (иначе конфликт getUpdates).
- **grammY webhookCallback** поддерживает secretToken опцию — использовать встроенную проверку.

## Не делать

- ❌ Не делать webhook без secret_token
- ❌ Не публиковать webhook URL
- ❌ Не ломать dev long-polling
- ❌ Не обрабатывать pending при переключении (drop)
