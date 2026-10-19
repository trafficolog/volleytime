import { env } from './env'

export interface WebCallOptions {
  method?: 'GET' | 'POST'
  query?: Record<string, string>
  body?: unknown
  timeoutMs?: number
}

/**
 * Внутренний вызов web (общий секрет, внутренняя сеть). Любая ошибка — `null`: бот отвечает
 * пользователю «сервис недоступен», в лог идёт только путь и код ответа (без секрета и без
 * Telegram id/токенов из запроса).
 */
export async function callWeb<T>(path: string, opts: WebCallOptions = {}): Promise<T | null> {
  const url = new URL(`${env.WEB_URL}/api/internal/bot/${path}`)
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'x-internal-secret': env.INTERNAL_SECRET,
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
    })
    if (!res.ok) {
      console.warn('[bot] web call failed', { path, status: res.status })
      return null
    }
    return (await res.json()) as T
  } catch {
    console.warn('[bot] web call failed', { path, status: 'network' })
    return null
  }
}

/** Бот снова доступен пользователю — снять `users.bot_blocked_at` (20.3.2/20.3.3). Сбой не критичен. */
export async function markUserReachable(telegramId: number | string): Promise<void> {
  await callWeb('reachable', { method: 'POST', body: { telegramId: String(telegramId) } })
}
