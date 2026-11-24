import { groupPageModerationService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Страницы групп: каталог городов',
    description:
      '24.1.3 (R-06): справочник городов (все районные центры и Минск, по областям) со счётчиками ' +
      'страниц групп: pages, indexed, noindex, hidden, issues (решение root или новые жалобы). ' +
      'Страница — группа активна, не удалена, и страница опубликована владельцем или на ней ' +
      'действует решение root. Города групп вне справочника — в other. Только Root Admin.',
    responses: {
      200: {
        description:
          'PlatformGroupPageCities: { regions, other, totals } (тип в @volley-time/shared)',
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Не root (forbidden.root_only)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.groupPages)
  setResponseHeader(event, 'cache-control', 'no-store')
  return groupPageModerationService.cities({ userId: user.id })
})
