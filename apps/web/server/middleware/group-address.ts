import { resolveGroupAddress } from '@volley-time/core'
import { cityCatalogPath, cityNameBySlug } from '@volley-time/shared'

/**
 * Адреса страниц групп (24.2.1, D-26): постоянный 301 на действующий адрес `/{город}/{группа}`.
 * - `/g/<slug>` — прежний адрес 24.1.2; без города справочника он и есть действующий;
 * - `/{город}/{группа}` — прежний адрес после смены города или slug (история адресов);
 * - `/volleyball/<город>` — прежний каталог города справочника → `/{город}`.
 * Действующий адрес, скрытая или неопубликованная группа и неизвестный адрес идут дальше: страницу
 * (или её 404) рендерит приложение. Query-строка сохраняется.
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') return
  const url = getRequestURL(event)
  const m = /^\/([a-z0-9-]+)\/([^/]+)\/?$/.exec(url.pathname)
  if (!m) return
  const [, first, second] = m as unknown as [string, string, string]
  const moved = (path: string) => sendRedirect(event, `${path}${url.search}`, 301)

  if (first === 'volleyball') {
    let name: string
    try {
      name = decodeURIComponent(second)
    } catch {
      return
    }
    const path = cityCatalogPath(name)
    if (path.startsWith('/volleyball/')) return
    return moved(path)
  }
  if (first !== 'g' && !cityNameBySlug(first)) return
  const resolved = await resolveGroupAddress(first === 'g' ? null : first, second)
  if (resolved?.kind === 'moved') return moved(resolved.path)
})
