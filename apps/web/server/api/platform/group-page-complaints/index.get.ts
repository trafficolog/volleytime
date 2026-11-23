import { groupPageModerationService } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Жалобы на страницы групп',
    description:
      '24.1.3 (R-06): жалобы посетителей с публичных страниц групп (не жалобы на организатора и ' +
      'оплату). status: new — новые; closed — решённые и отклонённые; all. Автор — только root: ' +
      'пользователь, если вошёл, иначе anonymous. stats: open, oldestOpenAt, closed30d, ' +
      'avgHoursToClose30d, limited30d (отсечено лимитом 3 в сутки). До 200 записей, новые сверху.',
    parameters: [
      {
        in: 'query',
        name: 'status',
        schema: { type: 'string', enum: ['new', 'closed', 'all'], default: 'new' },
      },
    ],
    responses: {
      200: { description: 'PlatformGroupPageComplaints: { items, stats }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не root (forbidden.root_only)' },
      422: { description: 'Неверный запрос (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return groupPageModerationService.complaints({ userId: user.id }, getQuery(event))
})
