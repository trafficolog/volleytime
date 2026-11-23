import { groupPageService, requireCanManageContent } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Страница группы',
    description:
      'Содержимое конструктора страницы группы (24.1.1, D-24) и данные группы для предпросмотра: ' +
      'город, уровни, залы, ближайшие 5 событий, действующие мета и предупреждения. Строки нет — ' +
      'страница по умолчанию (isDefault). Доступно владельцу и организатору.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: {
        description:
          '{ page: GroupPageView } — content, isDefault, updatedAt, seoIndex, publicPageEnabled, ' +
          'moderation (решение root 24.1.3: state hidden|noindex, reasonCode, reasonTitle, note, ' +
          'decidedAt; без автора; null — решения нет), group, venues, upcomingEvents, resolved, ' +
          'warnings (тип в @volley-time/shared)',
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы или недостаточно прав (forbidden.*)' },
      404: { description: 'Группа не найдена (organization.not_found)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const page = await groupPageService.get(ctx, event.context.organization!.id)
  return { page }
})
