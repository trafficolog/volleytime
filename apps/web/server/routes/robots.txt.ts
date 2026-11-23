/** robots.txt (24.1.2): приватные разделы и API закрыты, публичные страницы — по sitemap. */
export default defineEventHandler((event) => {
  const origin = getRequestURL(event).origin
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  return [
    'User-agent: *',
    'Disallow: /api/',
    'Disallow: /app/',
    'Disallow: /m/',
    'Disallow: /root',
    'Disallow: /auth/',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
})
