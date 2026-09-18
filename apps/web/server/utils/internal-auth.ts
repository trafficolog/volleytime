import { timingSafeEqual } from 'node:crypto'

import type { H3Event } from 'h3'

/** Сравнение секретов за постоянное время (Task 8.8.10). */
export function internalSecretsMatch(expected: string, got: unknown): boolean {
  if (!expected || typeof got !== 'string' || got.length === 0) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(got)
  if (a.length !== b.length) {
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

/** Требует внутренний секрет (запросы от бота во внутренней сети). */
export function requireInternalSecret(event: H3Event): void {
  const expected = getServerConfig().botInternalSecret
  if (!internalSecretsMatch(expected, getRequestHeader(event, 'x-internal-secret'))) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}
