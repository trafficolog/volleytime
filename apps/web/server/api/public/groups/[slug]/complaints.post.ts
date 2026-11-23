import { submitGroupPageComplaint } from '@volley-time/core'

import { complaintReporter } from '../../../../utils/complaint-reporter'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['public'],
    summary: 'Пожаловаться на страницу группы',
    description:
      '24.1.3 (R-06): без авторизации. Причина из списка и необязательные подробности (до 500). ' +
      'Не больше 3 жалоб за сутки с устройства (HMAC адреса клиента): сверх лимита 429 ' +
      'group_page.complaint_limited; плюс общий публичный лимит. Если посетитель вошёл, жалоба ' +
      'связывается с ним — это видит только root, организатор не узнаёт, кто пожаловался. ' +
      'Неизвестный slug, неопубликованная и скрытая страница — одинаковый 404.',
    parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['reasonCode'],
            additionalProperties: false,
            properties: {
              reasonCode: {
                type: 'string',
                enum: ['price', 'inactive', 'media', 'fraud', 'other'],
              },
              details: { type: 'string', nullable: true, description: 'до 500 символов' },
            },
          },
        },
      },
    },
    responses: {
      201: { description: '{ ok: true } — жалоба принята' },
      404: { description: 'Страница не найдена (group_page.not_found)' },
      422: { description: 'Нет причины или неверное поле (validation_failed)' },
      429: {
        description: 'Лимит жалоб (group_page.complaint_limited) или запросов (rate_limited)',
      },
    },
  },
})

/** Жалоба посетителя на публичную страницу группы (24.1.3): кнопка «Пожаловаться» на `/g/<slug>`. */
export default defineApiHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')
  const body = await readBody(event).catch(() => null)
  await submitGroupPageComplaint(
    getRouterParam(event, 'slug') ?? '',
    body ?? {},
    await complaintReporter(event),
  )
  setResponseStatus(event, 201)
  // ответ не раскрывает ни id жалобы, ни состояние страницы
  return { ok: true }
})
