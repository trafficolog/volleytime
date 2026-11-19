import { assertRootAdmin } from '@volley-time/core'

/** Страницы Root Admin: `/root` и всё под ним (не `/rooted`). */
const ROOT_PAGE = /^\/root(?:\/|$)/

/**
 * Страницы `/root/**` (22.1.1): вошедший пользователь без `users.is_root_admin` получает 403 на
 * уровне сервера, ещё до загрузки приложения. Без сессии запрос проходит: приложение (SPA, как
 * кабинет `/app`) само отправляет на вход. Данные отдаёт `/api/platform/**` — там root обязателен
 * независимо от этого middleware.
 */
export default defineEventHandler(async (event) => {
  if (!ROOT_PAGE.test(getRequestURL(event).pathname)) return
  setResponseHeader(event, 'cache-control', 'no-store')
  let userId: number
  try {
    userId = (await requireAuth(event)).id
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 401) return
    throw e
  }
  try {
    await assertRootAdmin({ userId })
  } catch (e) {
    handleServiceError(e)
  }
})
