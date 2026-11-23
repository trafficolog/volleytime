import { groupPageModerationService } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Вернуть страницу группы',
    description:
      '24.1.3 (R-06): «Вернуть» / «Вернуть индексацию» — решение root снимается без причины; ' +
      'дальше страницу и индексацию решают publicPageEnabled и seoIndex владельца. Пишется ' +
      'audit_log, владельцу и организаторам уходит уведомление. Только Root Admin.',
    parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: 'PlatformGroupPageRow после снятия решения' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не root (forbidden.root_only)' },
      404: { description: 'Группа не найдена (organization.not_found)' },
      409: { description: 'Решения нет (group_page.not_moderated)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const id = pathId(getRouterParam(event, 'id'))
  return withNotifications((notifications) =>
    groupPageModerationService.restore({ userId: user.id, notifications }, id),
  )
})
