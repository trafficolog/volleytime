import { LogoNotFoundError, organizationBrandingService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Логотип группы (публичный)',
    description:
      '21.2.16, решение владельца 2026-11-09: логотип читается без входа и без членства (tenant ' +
      'middleware этот маршрут пропускает). Отдаёт PNG или JPEG: Content-Type по содержимому, ' +
      'X-Content-Type-Options: nosniff, Content-Security-Policy: sandbox, ETag по версии ' +
      '(If-None-Match даёт 304), Cache-Control: public, max-age=300, must-revalidate. Нет логотипа, ' +
      'нет группы или неверный id — один и тот же 404 (наличие группы не раскрывается).',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: 'Тело изображения' },
      304: { description: 'Версия не изменилась' },
      404: { description: 'Логотипа нет (или группы нет)' },
    },
  },
})

const NOT_FOUND = () => createError({ statusCode: 404, statusMessage: 'Not found' })

export default defineApiHandler(async (event) => {
  const id = Number(getRouterParam(event, 'orgId'))
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) throw NOT_FOUND()
  let logo
  try {
    // публичный чтение-только вызов: пользователя нет, права не проверяются
    logo = await organizationBrandingService.getLogo({ userId: 0 }, id)
  } catch (error) {
    if (error instanceof LogoNotFoundError) throw NOT_FOUND()
    throw error
  }
  const etag = `"${logo.updatedAt.getTime()}"`
  // файл не должен исполниться или отрисоваться как страница, даже если откроют по прямой ссылке
  setResponseHeaders(event, {
    'Content-Type': logo.mimeType,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cache-Control': 'public, max-age=300, must-revalidate',
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
