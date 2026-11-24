import { groupPageModerationService } from '@volley-time/core'
import { PLATFORM_POLICIES } from '@volley-time/shared'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Скрыть страницу группы или закрыть от поиска',
    description:
      '24.1.3 (R-06): решение root поверх настроек владельца. hidden — /g/<slug>, его API, ' +
      'короткая ссылка, каталог и sitemap отвечают как для неопубликованной страницы (404, нет в ' +
      'списках); noindex — страница открывается, но noindex в meta и X-Robots-Tag, нет в sitemap ' +
      'и каталоге. Причина обязательна, её и заметку видит организатор (кабинет и бот). Смена ' +
      'hidden ↔ noindex — новое решение. Пишется audit_log, владельцу и организаторам уходит ' +
      'уведомление. Только Root Admin.',
    parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['state', 'reasonCode'],
            additionalProperties: false,
            properties: {
              state: { type: 'string', enum: ['hidden', 'noindex'] },
              reasonCode: {
                type: 'string',
                enum: ['price', 'pay', 'promise', 'media', 'inactive', 'spam'],
              },
              note: {
                type: 'string',
                nullable: true,
                description: '«Что исправить», необязательно, до 1000 символов',
              },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'PlatformGroupPageRow после решения' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не root (forbidden.root_only)' },
      404: { description: 'Группа не найдена (organization.not_found)' },
      409: {
        description:
          'Решение уже действует (group_page.moderation_same_state) или noindex поверх noindex ' +
          'владельца (group_page.owner_noindex)',
      },
      422: { description: 'Нет причины или неверное поле (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requirePlatformRole(event, ...PLATFORM_POLICIES.groupPagesModerate)
  setResponseHeader(event, 'cache-control', 'no-store')
  const id = pathId(getRouterParam(event, 'id'))
  const body = await readBody(event).catch(() => null)
  return withNotifications((notifications) =>
    groupPageModerationService.act({ userId: user.id, notifications }, id, body ?? {}),
  )
})
