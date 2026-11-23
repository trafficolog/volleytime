import { listPublicSitemap } from '@volley-time/core'

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * sitemap.xml (24.1.2): главная, индексируемые страницы групп и каталоги их городов. Страница
 * группы без `seoIndex` или не опубликованная сюда не попадает.
 */
export default defineEventHandler(async (event) => {
  const origin = getRequestURL(event).origin
  const entries = await listPublicSitemap()
  const urls = [
    `  <url><loc>${escapeXml(`${origin}/`)}</loc></url>`,
    ...entries.map(
      (e) => `  <url><loc>${escapeXml(origin + e.path)}</loc><lastmod>${e.lastmod}</lastmod></url>`,
    ),
  ]
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=300, s-maxage=300')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
})
