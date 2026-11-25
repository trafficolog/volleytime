import { resolvePublicShortLink } from '@volley-time/core'

import { shortLinkCandidate } from '../utils/short-link-path'

/**
 * Короткая ссылка группы `volleytime.by/<имя>` (21.2.16) ведёт на действующий адрес публичной
 * страницы группы (24.2.1: `/{город}/{группа}`): 302, чтобы смена или снятие ссылки не застревали
 * в кешах. Ссылка группы без опубликованной страницы и неизвестное имя — дальше: каталог города
 * `/{город}` или обычный 404 приложения.
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return
  const name = shortLinkCandidate(getRequestURL(event).pathname)
  if (!name) return
  const path = await resolvePublicShortLink(name)
  if (path) return sendRedirect(event, path, 302)
})
