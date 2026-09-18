/**
 * Простой in-memory rate limiter для /api/auth/* (Task 9.9.11).
 * Плагин rate_limit для Caddy требует пересборки образа — решили ограничивать в приложении.
 * Память ограничена: старые окна вычищаются при обращении.
 */
export interface RateLimitOptions {
  limit: number
  windowMs: number
  now?: () => number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export class RateLimiter {
  private hits = new Map<string, number[]>()

  constructor(private readonly options: RateLimitOptions) {}

  check(key: string): RateLimitResult {
    const now = this.options.now?.() ?? Date.now()
    const from = now - this.options.windowMs
    const recent = (this.hits.get(key) ?? []).filter((t) => t > from)

    if (recent.length >= this.options.limit) {
      this.hits.set(key, recent)
      const retryAfterMs = recent[0]! + this.options.windowMs - now
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      }
    }

    recent.push(now)
    this.hits.set(key, recent)
    // подчистка: ключи без свежих попыток не держим
    if (this.hits.size > 5000) {
      for (const [k, times] of this.hits) {
        if (times.every((t) => t <= from)) this.hits.delete(k)
      }
    }
    return { allowed: true, remaining: this.options.limit - recent.length, retryAfterSeconds: 0 }
  }
}

/**
 * Ключ клиента для лимитера (Task 9.10.1). Заголовку X-Forwarded-For доверяем только
 * за своим прокси (TRUSTED_PROXY=1) и берём ПОСЛЕДНИЙ элемент цепочки — его добавляет
 * наш Caddy, подделать его клиент не может. Иначе — адрес соединения.
 */
export function clientKeyFromRequest(input: {
  remoteAddress?: string | null
  forwardedFor?: string | null
  trustProxy?: boolean
}): string {
  if (input.trustProxy && input.forwardedFor) {
    const chain = input.forwardedFor
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    const last = chain.at(-1)
    if (last) return last
  }
  return input.remoteAddress?.trim() || 'unknown'
}
