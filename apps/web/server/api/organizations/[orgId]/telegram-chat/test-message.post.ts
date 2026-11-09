import { requireCanManageContent, telegramChatService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['telegram-chat'],
    summary: 'Тестовое сообщение в Telegram-чат группы',
    description:
      'Отправляет в привязанный чат этой группы фиксированное тестовое сообщение (21.2.15); текст ' +
      'не берётся из запроса, адресат — только чат группы из пути. Лимит: 3 запроса в минуту на ' +
      'группу. Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: '{ sent: true }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      409: {
        description:
          'Чат не привязан или недействителен (telegram_chat.not_linked|bot_removed|no_rights|migrated)',
      },
      429: { description: 'Слишком много запросов (telegram_chat.rate_limited)' },
      502: { description: 'Доставка не удалась (telegram_chat.delivery_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const orgId = event.context.organization!.id
  limitOrgChatTest(event, orgId)
  setResponseHeader(event, 'cache-control', 'no-store')
  return telegramChatService.sendTestMessage(createServiceContextFromEvent(event), orgId)
})
