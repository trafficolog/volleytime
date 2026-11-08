import {
  LOGO_MAX_BYTES,
  organizationBrandingService,
  requireCanManageContent,
} from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Загрузить логотип группы',
    description:
      '21.2.16. multipart/form-data, поле file: PNG или JPEG до 512 КБ (SVG не принимается). Сервер ' +
      'проверяет размер, сигнатуру файла и совпадение заявленного типа с содержимым. Заменяет ' +
      'прежний логотип. Пишет audit organization.logo_updated. Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary' } },
            required: ['file'],
          },
        },
      },
    },
    responses: {
      200: { description: '{ logoUpdatedAt, mimeType, sizeBytes }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'Группа не найдена' },
      410: { description: 'Группа в архиве (organization.archived)' },
      411: { description: 'Нет Content-Length' },
      413: { description: 'Файл больше 512 КБ (logo.too_large)' },
      422: { description: 'Не PNG/JPEG, тип не совпадает с содержимым, пустой файл (logo.invalid)' },
    },
  },
})

/** Запас на границы multipart и заголовки частей сверх самого файла. */
const MULTIPART_OVERHEAD_BYTES = 16 * 1024

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  // тело читается целиком в память: размер проверяется до чтения
  const length = Number(getRequestHeader(event, 'content-length'))
  if (!Number.isInteger(length) || length <= 0) {
    throw createError({
      statusCode: 411,
      statusMessage: 'Content-Length required',
      data: { code: 'logo.length_required' },
    })
  }
  if (length > LOGO_MAX_BYTES + MULTIPART_OVERHEAD_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Logo is too large',
      data: { code: 'logo.too_large' },
    })
  }
  const contentType = getRequestHeader(event, 'content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw createError({
      statusCode: 422,
      statusMessage: 'multipart/form-data expected',
      data: { code: 'logo.invalid' },
    })
  }
  const parts = await readMultipartFormData(event)
  const file = parts?.find((part) => part.name === 'file' && part.filename !== undefined)
  if (!file) {
    throw createError({
      statusCode: 422,
      statusMessage: 'File field "file" is required',
      data: { code: 'logo.invalid' },
    })
  }
  return organizationBrandingService.setLogo(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    { declaredType: file.type, data: file.data },
  )
})
