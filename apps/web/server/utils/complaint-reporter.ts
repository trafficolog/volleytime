import { createHmac } from 'node:crypto'

import type { H3Event } from 'h3'

import { clientKeyFromRequest } from './rate-limit'

/**
 * Устройство для лимита жалоб (24.1.3): HMAC-SHA256 ключа клиента (адрес; X-Forwarded-For — только
 * за своим прокси, TRUSTED_PROXY=1) на секрете приложения. Сам адрес не хранится, хеш без секрета
 * не обратим и не сопоставим между установками.
 */
export function complaintDeviceHash(clientKey: string, secret: string): string {
  return createHmac('sha256', `group-page-complaint:${secret}`).update(clientKey).digest('hex')
}

/**
 * Автор жалобы: пользователь, если посетитель вошёл (видит только root), и хеш устройства. Без
 * сессии, с недействительной сессией или у заблокированного жалоба анонимна — вход не требуется.
 */
export async function complaintReporter(
  event: H3Event,
): Promise<{ userId: number | null; hash: string }> {
  const client = clientKeyFromRequest({
    remoteAddress: event.node?.req?.socket?.remoteAddress,
    forwardedFor: getRequestHeader(event, 'x-forwarded-for'),
    trustProxy: process.env.TRUSTED_PROXY === '1',
  })
  const userId = await requireAuth(event).then(
    (u) => u.id,
    () => null,
  )
  return { userId, hash: complaintDeviceHash(client, process.env.BETTER_AUTH_SECRET ?? '') }
}
