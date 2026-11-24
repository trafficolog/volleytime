import { groupPageModerationService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'История страницы группы',
    description:
      '24.1.3 (R-06): состояние модерации страницы и журнал: решения root (hidden, noindex, ' +
      'restored — причина, заметка, автор) и жалобы посетителей (причина, без автора). Новые ' +
      'сверху. Только Root Admin.',
    parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: 'PlatformGroupPageHistory: { page, entries }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не root (forbidden.root_only)' },
      404: { description: 'Группа не найдена (organization.not_found)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.groupPages)
  setResponseHeader(event, 'cache-control', 'no-store')
  return groupPageModerationService.history(
    { userId: user.id },
    pathId(getRouterParam(event, 'id')),
  )
})
