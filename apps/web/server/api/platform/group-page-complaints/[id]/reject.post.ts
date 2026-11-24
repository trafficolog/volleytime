import { groupPageModerationService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Отклонить жалобу на страницу группы',
    description:
      '24.1.3 (R-06): «Отклонить» — нарушений нет (status rejected, resolution no_violation). ' +
      'Страница не меняется, организатор не уведомляется. Только Root Admin.',
    parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: '{ id }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не root (forbidden.root_only)' },
      404: { description: 'Жалоба не найдена (group_page.complaint_not_found)' },
      409: { description: 'Жалоба уже закрыта (group_page.complaint_closed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.groupPageComplaintsReject)
  setResponseHeader(event, 'cache-control', 'no-store')
  return groupPageModerationService.rejectComplaint(
    { userId: user.id },
    pathId(getRouterParam(event, 'id')),
  )
})
