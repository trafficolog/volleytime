import { requireCanManageContent, seriesService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['events'],
    summary: 'Предпросмотр серии событий',
    description:
      'P-06, 20.2.2, D-04: ничего не пишет. Даты серии в часовом поясе группы, статус каждой ' +
      '(published | draft, причина черновика balance | venue_conflict), число публикуемых и ' +
      'черновиков, баланс до и после. Тело — как у POST …/series. Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: 'SeriesPreview' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
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
  return seriesService.preview(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    body,
  )
})
