import { createServer, type Server } from 'node:http'

import { webhookCallback, type Bot } from 'grammy'

import type { BotContext } from './context'
import { env } from './env'

/**
 * Webhook-сервер (production). Telegram шлёт updates через Caddy на секретный путь.
 * secret_token проверяется grammY (защита от спуфинга).
 */
export function startWebhookServer(bot: Bot<BotContext>, port = 8443): Server {
  const handleUpdate = webhookCallback(bot, 'http', {
    secretToken: env.WEBHOOK_SECRET_TOKEN,
  })

  const server = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 404
      res.end()
      return
    }
    try {
      await handleUpdate(req, res)
    } catch (e) {
      console.error('[webhook] error', e)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end()
      }
    }
  })
  server.listen(port, () => console.log(`[bot] webhook listening :${port}`))
  return server
}

/** Зарегистрировать webhook в Telegram (при старте в production). */
export async function registerWebhook(bot: Bot<BotContext>): Promise<void> {
  if (!env.WEBHOOK_URL) throw new Error('WEBHOOK_URL is not set')
  await bot.api.setWebhook(env.WEBHOOK_URL, {
    secret_token: env.WEBHOOK_SECRET_TOKEN,
    // не теряем апдейты, накопившиеся во время деплоя (Task 9.9.10)
    drop_pending_updates: false,
  })
  console.log('[bot] webhook registered:', env.WEBHOOK_URL)
}
