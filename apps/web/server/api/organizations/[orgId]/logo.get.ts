import { organizationBrandingService, requireOrgMember } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Логотип группы',
    description:
      '21.2.16. Отдаёт загруженный логотип (PNG или JPEG) активному участнику группы. Content-Type ' +
      'по содержимому, X-Content-Type-Options: nosniff, Content-Security-Policy: sandbox, ETag по ' +
      'версии (If-None-Match даёт 304). Cache-Control: private, no-cache (проверка версии на каждый ' +
      'показ, тело не передаётся повторно). Без логотипа — 404 (logo.not_found).',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: 'Тело изображения' },
      304: { description: 'Версия не изменилась' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы' },
      404: { description: 'Группа не найдена или логотипа нет' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const logo = await organizationBrandingService.getLogo(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
  )
  const etag = `"${logo.updatedAt.getTime()}"`
  // файл не должен исполниться или отрисоваться как страница, даже если откроют по прямой ссылке
  setResponseHeaders(event, {
    'Content-Type': logo.mimeType,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cache-Control': 'private, no-cache',
    ETag: etag,
  })
  const candidates = (getRequestHeader(event, 'if-none-match') ?? '')
    .split(',')
    .map((v) => v.trim().replace(/^W\//, ''))
  if (candidates.includes(etag) || candidates.includes('*')) {
    setResponseStatus(event, 304)
    return null
  }
  return logo.data
})
