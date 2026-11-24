import { groupPageModerationService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Страницы групп города',
    description:
      '24.1.3 (R-06): страницы групп с состоянием index (в поиске), own (noindex владельца), ' +
      'noindex и hidden (решение root: причина, заметка, кто и когда), числом новых жалоб и ' +
      'временем обновления. city не задан — вся страна. Только Root Admin.',
    parameters: [
      { in: 'query', name: 'city', schema: { type: 'string', description: 'до 100 символов' } },
      {
        in: 'query',
        name: 'filter',
        schema: { type: 'string', enum: ['all', 'moderated', 'complaints'], default: 'all' },
      },
      {
        in: 'query',
        name: 'q',
        description: 'Название группы или slug, от 2 символов',
        schema: { type: 'string' },
      },
    ],
    responses: {
      200: { description: 'PlatformGroupPagesList: { items: PlatformGroupPageRow[] }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не root (forbidden.root_only)' },
      422: { description: 'Неверный запрос (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.groupPages)
  setResponseHeader(event, 'cache-control', 'no-store')
  return groupPageModerationService.list({ userId: user.id }, getQuery(event))
})
