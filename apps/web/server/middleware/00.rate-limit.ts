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

/**
 * Публичные маршруты без авторизации (`/api/public/**`, 20.6.1): чтение ходит в БД, поэтому
 * ограничено по клиенту — защита от перебора slug и нагрузки. PUBLIC_RATE_LIMIT / PUBLIC_RATE_WINDOW_MS.
 */
const publicLimiter = new RateLimiter({
  limit: Number(process.env.PUBLIC_RATE_LIMIT ?? 120),
  windowMs: Number(process.env.PUBLIC_RATE_WINDOW_MS ?? 60_000),
})

/** Публичная страница события: `/e/<slug>` — HTML, `/api/public/**` — JSON (20.6.1). */
const PUBLIC_HTML = /^\/e\/[^/]+\/?$/

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  const isAuth = path.startsWith('/api/auth/') && event.method !== 'GET' // get-session дергается на каждой навигации
  const isPublicApi = path.startsWith('/api/public/')
  const isPublic = isPublicApi || PUBLIC_HTML.test(path)
  if (!isAuth && !isPublic) return

  const remoteAddress = event.node.req.socket.remoteAddress
  // Серверный рендер страницы вызывает `/api/public/**` внутри процесса: у такого вызова нет
  // адреса соединения (у внешнего он есть всегда), даже если заголовки запроса пробросили
  // X-Forwarded-For. Клиента уже посчитал запрос HTML (`/e/<slug>`) с тем же ключом, поэтому
  // внутренний вызов не считаем: иначе просмотр страницы стоил бы два запроса.
  if (isPublicApi && !remoteAddress) return

  const client = clientKeyFromRequest({
    remoteAddress,
    forwardedFor: getRequestHeader(event, 'x-forwarded-for'),
    trustProxy: process.env.TRUSTED_PROXY === '1',
  })
  // HTML и JSON публичных маршрутов делят один лимит и один ключ клиента
  const result = (isPublic ? publicLimiter : limiter).check(
    `${client}:${isPublic ? 'public' : path}`,
  )
  if (!result.allowed) {
    setResponseHeader(event, 'retry-after', String(result.retryAfterSeconds))
    throw createError({
      statusCode: 429,
      statusMessage: 'Слишком много попыток, попробуйте позже',
      data: { code: 'rate_limited', retryAfterSeconds: result.retryAfterSeconds },
    })
  }
})
