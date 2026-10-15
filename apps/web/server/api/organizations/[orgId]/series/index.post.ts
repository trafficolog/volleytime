import { requireCanManageContent, seriesService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Создать серию событий',
    description:
      'P-06, 20.2.2, D-04: серия создаётся атомарно целиком; даты в пределах баланса публикуются и ' +
      'списывают по одному событию, остальные — черновики; дата с занятым залом — черновик. ' +
      'idempotencyKey (8–64 символа [A-Za-z0-9_-]) делает повтор безопасным: тот же ключ возвращает ' +
      'уже созданную серию (replayed = true), другой запрос с тем же ключом — 409. Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: {
        description:
          '{ series, events, total, published, drafts, venueConflicts, balanceAfter, replayed }',
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      409: { description: 'series.idempotency_conflict, выключенные возможности события' },
      422: {
        description:
          'series.invalid_rule, series.too_many_dates, event.starts_in_past, event.venue_not_in_org, неверное тело',
      },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const body = await readBody(event)
  return seriesService.create(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    body,
  )
})
