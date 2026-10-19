/**
 * Ошибка доставки в Telegram (20.3.2). Транспорт переводит ответ бота в один из видов, чтобы
 * журнал `scheduled_jobs` решал, что делать, не разбирая текст ошибок Bot API:
 * - `blocked` — бот заблокирован пользователем, чат не найден или аккаунт удалён: повтор бессмыслен,
 *   получатель помечается недоступным;
 * - `rate_limited` — лимит Bot API (429): повтор не раньше `retryAfterMs`, попытка не засчитывается;
 * - `transient` — прочий сбой (таймаут, 5xx): повтор с backoff.
 */
export type DeliveryErrorKind = 'blocked' | 'rate_limited' | 'transient'

export class DeliveryError extends Error {
  constructor(
    readonly kind: DeliveryErrorKind,
    readonly retryAfterMs?: number,
  ) {
    super(`delivery ${kind}`)
    this.name = 'DeliveryError'
  }
}

/** Максимальная пауза по `retry_after`: защита от некорректного значения. */
const MAX_RETRY_AFTER_MS = 10 * 60_000

/**
 * HTTP-статус ответа internal-сервера бота -> вид ошибки: 410 — получатель недоступен
 * (бот отвечает им на 403/«chat not found» Bot API), 429 — лимит с `retry-after` в секундах.
 */
export function deliveryErrorFromStatus(
  status: number | undefined,
  retryAfterSeconds?: number,
): DeliveryError {
  if (status === 410) return new DeliveryError('blocked')
  if (status === 429) {
    const seconds =
      retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds)
        ? Math.max(1, retryAfterSeconds)
        : 30
    return new DeliveryError('rate_limited', Math.min(MAX_RETRY_AFTER_MS, seconds * 1000))
  }
  return new DeliveryError('transient')
}
