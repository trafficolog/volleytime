import { isReservedShortLink, SHORT_LINK_PATTERN } from '@volley-time/core'

/**
 * Путь `/<имя>` может быть короткой ссылкой группы (21.2.16): один сегмент по формату короткой
 * ссылки и не зарезервированное слово. Возвращает имя строчными или null.
 */
export function shortLinkCandidate(pathname: string): string | null {
  const m = /^\/([A-Za-z0-9-]+)\/?$/.exec(pathname)
  if (!m) return null
  const name = m[1]!.toLowerCase()
  if (!SHORT_LINK_PATTERN.test(name) || name.includes('--') || isReservedShortLink(name))
    return null
  return name
}
