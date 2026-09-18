import { createServer, type IncomingMessage, type Server } from 'node:http'

import type { Bot } from 'grammy'

import type { BotContext } from './context'
import { env, secretsMatch } from './env'
import { captureError } from './sentry'

interface KeyboardButton {
  text: string
  url?: string
  webAppUrl?: string
}

interface NotifyPayload {
  telegramId: string
  text: string
  keyboard?: KeyboardButton[][]
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Преобразует наши кнопки в inline_keyboard Telegram. */
export function toInlineKeyboard(keyboard?: KeyboardButton[][]) {
  if (!keyboard?.length) return undefined
  return {
    inline_keyboard: keyboard.map((row) =>
      row.map((b) =>
        b.webAppUrl
          ? { text: b.text, web_app: { url: b.webAppUrl } }
          : { text: b.text, url: b.url ?? env.WEB_URL },
      ),
    ),
  }
}

/** Валидация payload перед отправкой. */
export function isValidPayload(v: unknown): v is NotifyPayload {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  return typeof p.telegramId === 'string' && p.telegramId.length > 0 && typeof p.text === 'string'
}

/**
 * Internal notify server: принимает уведомления от web (внутренняя docker-сеть)
 * и доставляет их в Telegram. Защищён shared secret.
 */
export function startInternalServer(bot: Bot<BotContext>, port = 3001): Server {
  const startedAt = Date.now()
  const server = createServer(async (req, res) => {
    // health для мониторинга и compose healthcheck (Task 9.9.10)
    if (req.method === 'GET' && req.url === '/healthz') {
      res.statusCode = 200
      res.setHeader('content-type', 'application/json')
      res.end(
        JSON.stringify({
          status: 'ok',
          mode: env.BOT_MODE,
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
          release: process.env.RELEASE_VERSION ?? 'dev',
        }),
      )
      return
    }
    if (req.method !== 'POST' || req.url !== '/internal/notify') {
      res.statusCode = 404
      res.end()
      return
    }
    if (!secretsMatch(env.INTERNAL_SECRET, req.headers['x-internal-secret'])) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }
    try {
      const body = await readJsonBody(req)
      if (!isValidPayload(body)) {
        res.statusCode = 422
        res.end('Invalid payload')
        return
      }
      await bot.api.sendMessage(body.telegramId, body.text, {
        parse_mode: 'HTML',
        reply_markup: toInlineKeyboard(body.keyboard),
      })
      res.statusCode = 200
      res.end('OK')
    } catch (e) {
      console.error('[internal-notify] failed', e)
      captureError(e, { scope: 'internal-notify' })
      res.statusCode = 500
      res.end('Error')
    }
  })
  server.listen(port, () => console.log(`[bot] internal notify listening :${port}`))
  return server
}
