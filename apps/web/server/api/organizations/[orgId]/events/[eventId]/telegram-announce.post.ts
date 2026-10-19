import { requireCanManageContent, telegramChatService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['telegram-chat'],
    summary: 'Анонс события в Telegram-чат группы',
    description:
      'Публикует в привязанном чате группы анонс события (20.3.4): дата, место, «Свободно N из M мест» ' +
      'и кнопки-ссылки `t.me/<бот>?startapp=event_<id>`. Текст строится из данных события, не из тела ' +
      'запроса. Только опубликованное событие этой группы; чат должен быть привязан и действующим. ' +
      'Владелец и организатор.',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'path', name: 'eventId', required: true, schema: { type: 'integer' } },
    ],
    responses: {
      200: { description: '{ announced: true }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'Событие не найдено в этой группе (event.not_found)' },
      409: {
        description:
          'Чат не привязан или недействителен (telegram_chat.not_linked|bot_removed|no_rights|migrated), событие не анонсируется (telegram_chat.event_not_announceable)',
      },
      429: { description: 'Лимит Bot API или слишком много запросов (telegram_chat.rate_limited)' },
      502: { description: 'Доставка не удалась (telegram_chat.delivery_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const orgId = event.context.organization!.id
  const eventId = pathId(getRouterParam(event, 'eventId'))
  limitOrgChatAction(event, `announce:${orgId}`)
  return telegramChatService.announceEvent(createServiceContextFromEvent(event), orgId, eventId, {
    botUsername: getServerConfig().telegramBotUsername,
  })
})
