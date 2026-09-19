import type { Server } from 'node:http'

import type { Bot, BotError } from 'grammy'

import type { BotContext } from './context'
import { captureError } from './sentry'

const TELEGRAM_BOT_URL = /(https:\/\/api\.telegram\.org\/bot)[^/\s"']+/gi
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi

interface SanitizedOperationalError {
  name: string
  message: string
  code?: string
  cause?: SanitizedOperationalError
}

function redactOperationalText(value: string): string {
  return value.replace(TELEGRAM_BOT_URL, '$1[REDACTED]').replace(URL_CREDENTIALS, '$1[REDACTED]@')
}

export function sanitizeOperationalError(
  error: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): SanitizedOperationalError {
  if (typeof error !== 'object' || error === null) {
    return { name: 'Error', message: redactOperationalText(String(error)) }
  }
  if (seen.has(error)) return { name: 'Error', message: '[circular error]' }
  seen.add(error)

  const record = error as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name : 'Error'
  const message = typeof record.message === 'string' ? redactOperationalText(record.message) : name
  const code =
    typeof record.code === 'string' || typeof record.code === 'number'
      ? String(record.code)
      : undefined
  const nested = record.cause ?? record.error

  return {
    name,
    message,
    ...(code ? { code } : {}),
    ...(nested !== undefined && depth < 3
      ? { cause: sanitizeOperationalError(nested, depth + 1, seen) }
      : {}),
  }
}

export function logFatalError(error: unknown): void {
  console.error('[bot] fatal:', sanitizeOperationalError(error))
}

/** Ошибка в хендлере не должна валить бота (Task 3.9.7). */
export function handleBotError(err: BotError<BotContext>): void {
  console.error('[bot] update failed', {
    updateId: err.ctx?.update?.update_id,
    error: sanitizeOperationalError(err.error),
  })
  captureError(err.error, { updateId: err.ctx?.update?.update_id })
}

export function registerErrorHandler(bot: Bot<BotContext>): void {
  bot.catch(handleBotError)
}

export interface ShutdownDeps {
  bot: Pick<Bot<BotContext>, 'stop' | 'isRunning'>
  servers: Pick<Server, 'close'>[]
  exit?: (code: number) => void
}

/** Остановка: polling → HTTP-серверы → exit(0). Идемпотентна. */
export function createShutdown(deps: ShutdownDeps): (signal: string) => Promise<void> {
  let stopping = false
  return async (signal: string) => {
    if (stopping) return
    stopping = true
    console.log(`[bot] ${signal} received, shutting down…`)
    try {
      if (deps.bot.isRunning()) await deps.bot.stop()
      await Promise.all(
        deps.servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
      )
      ;(deps.exit ?? process.exit)(0)
    } catch (e) {
      console.error('[bot] shutdown error', e)
      ;(deps.exit ?? process.exit)(1)
    }
  }
}

export function setupGracefulShutdown(deps: ShutdownDeps): void {
  const shutdown = createShutdown(deps)
  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
}

/** Повтор операции с экспоненциальной паузой (старт бота при недоступном Telegram/БД, Task 9.9.10). */
export async function withRetries<T>(
  fn: () => Promise<T>,
  opts: {
    attempts?: number
    baseDelayMs?: number
    label?: string
    sleep?: (ms: number) => Promise<void>
  } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 5
  const base = opts.baseDelayMs ?? 1000
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  let lastError: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      console.error(
        `[bot] ${opts.label ?? 'operation'} failed (attempt ${i}/${attempts})`,
        sanitizeOperationalError(e),
      )
      if (i < attempts) await sleep(base * 2 ** (i - 1))
    }
  }
  throw lastError
}
