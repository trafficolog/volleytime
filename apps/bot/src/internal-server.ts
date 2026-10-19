import { createServer, type IncomingMessage, type Server } from 'node:http'

import { GrammyError, type Bot } from 'grammy'

import type { BotContext } from './context'
import { env, secretsMatch } from './env'
import { captureError } from './sentry'

interface KeyboardButton {
  text: string
  url?: string
  webAppUrl?: string
  /** Действие inline-кнопки (`<действие>:<id>`, 20.3.3); формат проверяется перед отправкой. */
  callbackData?: string
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
        b.callbackData
          ? { text: b.text, callback_data: b.callbackData }
          : b.webAppUrl
            ? { text: b.text, web_app: { url: b.webAppUrl } }
            : { text: b.text, url: b.url ?? env.WEB_URL },
      ),
    ),
  }
}

/** Причина недоступности группового чата (20.3.4); web помечает привязку недействительной. */
export type ChatFailureReason = 'bot_removed' | 'no_rights' | 'migrated'

export type SendFailure =
  | { kind: 'blocked'; code: number; reason?: ChatFailureReason }
  | { kind: 'rate_limited'; retryAfter: number }
  | { kind: 'other' }

/** Описания Bot API 400, при которых чат получателя недоступен навсегда. */
const UNREACHABLE_400 =
  /chat not found|user is deactivated|bot was blocked|PEER_ID_INVALID|have no rights|not enough rights|CHAT_WRITE_FORBIDDEN|CHAT_SEND_PLAIN_FORBIDDEN/i
/** Групповой чат: бота исключили или чат удалён. */
const BOT_REMOVED = /bot was kicked|bot is not a member|bot was removed|chat was deleted/i
/** Групповой чат: боту запретили писать. */
const NO_RIGHTS = /have no rights|not enough rights|CHAT_WRITE_FORBIDDEN|CHAT_SEND_PLAIN_FORBIDDEN/i

function chatFailureReason(e: GrammyError): ChatFailureReason | undefined {
  if (e.error_code === 400 && e.parameters?.migrate_to_chat_id) return 'migrated'
  if (BOT_REMOVED.test(e.description)) return 'bot_removed'
  if (NO_RIGHTS.test(e.description)) return 'no_rights'
  return undefined
}

/**
 * Ответ Bot API на отправку -> действие (20.3.2): 403 («bot was blocked by the user», «user is
 * deactivated») и 400 «chat not found» — получатель недоступен; 429 — лимит с `retry_after` (с).
 */
export function classifySendError(e: unknown): SendFailure {
  if (!(e instanceof GrammyError)) return { kind: 'other' }
  const reason = chatFailureReason(e)
  if (
    e.error_code === 403 ||
    (e.error_code === 400 && (UNREACHABLE_400.test(e.description) || reason === 'migrated'))
  )
    return { kind: 'blocked', code: e.error_code, ...(reason ? { reason } : {}) }
  if (e.error_code === 429)
    return { kind: 'rate_limited', retryAfter: e.parameters.retry_after ?? 30 }
  return { kind: 'other' }
}

/** Групповые чаты Telegram имеют отрицательный id: личные чаты и пользователи — положительный. */
export const isGroupChatId = (telegramId: string): boolean => telegramId.startsWith('-')

/** Ошибка отправки без payload запроса (`chat_id`, текст): код и описание Bot API либо имя ошибки. */
export function scrubSendError(e: unknown): { code?: number; description: string } {
  if (e instanceof GrammyError) return { code: e.error_code, description: e.description }
  return { description: e instanceof Error ? e.name : 'unknown' }
}

/** Валидация payload перед отправкой. */
export function isValidPayload(v: unknown): v is NotifyPayload {
  if (!v || typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  return (
    typeof p.telegramId === 'string' &&
    p.telegramId.length > 0 &&
    typeof p.text === 'string' &&
    hasValidKeyboard(p.keyboard) &&
    (!isGroupChatId(p.telegramId) || hasOnlyUrlButtons(p.keyboard))
  )
}

/** Разрешённые `callback_data` — те же, что понимает обработчик кнопок (handlers/callbacks.ts). */
export const NOTIFY_CALLBACK_RE = /^(cx|oa):\d{1,10}$/

/**
 * В групповом чате работают только кнопки-ссылки (20.3.4): `web_app` там не открывается, а кнопки
 * действий над записью принадлежат личному чату. Проверка на границе бота — последняя линия, даже
 * если web построит клавиатуру неверно.
 */
function hasOnlyUrlButtons(keyboard: unknown): boolean {
  if (keyboard === undefined) return true
  return (keyboard as Record<string, unknown>[][]).every((row) =>
    row.every(
      (b) =>
        b.webAppUrl === undefined &&
        b.callbackData === undefined &&
        typeof b.url === 'string' &&
        b.url.startsWith('https://'),
    ),
  )
}

function hasValidKeyboard(keyboard: unknown): boolean {
  if (keyboard === undefined) return true
  if (!Array.isArray(keyboard)) return false
  return keyboard.every(
    (row) =>
      Array.isArray(row) &&
      row.every((b) => {
        if (!b || typeof b !== 'object' || typeof (b as { text?: unknown }).text !== 'string')
          return false
        const data = (b as { callbackData?: unknown }).callbackData
        return data === undefined || (typeof data === 'string' && NOTIFY_CALLBACK_RE.test(data))
      }),
  )
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
      const failure = classifySendError(e)
      if (failure.kind === 'blocked') {
        // получатель недоступен (бот заблокирован, чат не найден): повтор бессмыслен, не ошибка бота
        console.warn('[internal-notify] recipient unreachable', failure.code, failure.reason)
        res.statusCode = 410
        if (failure.reason) res.setHeader('x-failure-reason', failure.reason)
        res.end('Gone')
        return
      }
      if (failure.kind === 'rate_limited') {
        console.warn('[internal-notify] rate limited', { retryAfter: failure.retryAfter })
        res.statusCode = 429
        res.setHeader('retry-after', String(failure.retryAfter))
        res.end('Too Many Requests')
        return
      }
      // запрос Bot API несёт chat_id и текст сообщения: наружу — только код и описание ошибки
      const scrubbed = scrubSendError(e)
      console.error('[internal-notify] failed', scrubbed)
      captureError(new Error(`[internal-notify] ${scrubbed.code ?? ''} ${scrubbed.description}`), {
        scope: 'internal-notify',
      })
      res.statusCode = 500
      res.end('Error')
    }
  })
  server.listen(port, () => console.log(`[bot] internal notify listening :${port}`))
  return server
}
