import { resolvePublicShortLink } from '@volley-time/core'

import { shortLinkCandidate } from '../utils/short-link-path'

/**
 * Короткая ссылка группы `volleytime.by/<имя>` (21.2.16) ведёт на публичную страницу группы
 * `/g/<slug>` (24.1.2): 302, чтобы смена или снятие ссылки не застревали в кешах. Ссылка группы
 * без опубликованной страницы и неизвестное имя — дальше, обычный 404 приложения.
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return
  const name = shortLinkCandidate(getRequestURL(event).pathname)
  if (!name) return
  const slug = await resolvePublicShortLink(name)
  if (slug) return sendRedirect(event, `/g/${slug}`, 302)
})
