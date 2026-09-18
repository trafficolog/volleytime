import { clientKeyFromRequest, RateLimiter } from '../utils/rate-limit'

/**
 * Ограничение частоты для эндпоинтов входа (Task 9.9.11): защита от брутфорса кода и initData.
 * Лимит и окно настраиваются через AUTH_RATE_LIMIT / AUTH_RATE_WINDOW_MS.
 * Ключ — адрес соединения; X-Forwarded-For учитывается только при TRUSTED_PROXY=1 (Task 9.10.1).
 */
const limiter = new RateLimiter({
  limit: Number(process.env.AUTH_RATE_LIMIT ?? 20),
  windowMs: Number(process.env.AUTH_RATE_WINDOW_MS ?? 60_000),
})

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/auth/')) return
  if (event.method === 'GET') return // get-session дергается на каждой навигации

  const client = clientKeyFromRequest({
    remoteAddress: event.node.req.socket.remoteAddress,
    forwardedFor: getRequestHeader(event, 'x-forwarded-for'),
    trustProxy: process.env.TRUSTED_PROXY === '1',
  })
  const result = limiter.check(`${client}:${path}`)
  if (!result.allowed) {
    setResponseHeader(event, 'retry-after', String(result.retryAfterSeconds))
    throw createError({
      statusCode: 429,
      statusMessage: 'Слишком много попыток, попробуйте позже',
      data: { code: 'rate_limited', retryAfterSeconds: result.retryAfterSeconds },
    })
  }
})
