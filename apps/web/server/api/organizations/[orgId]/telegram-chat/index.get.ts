import { requireCanManageContent, telegramChatService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['telegram-chat'],
    summary: 'Привязка Telegram-чата группы',
    description:
      'Состояние привязки группового чата (20.3.4): статус `active`/`invalid`, причина недействительности, ' +
      'право бота писать, срок выданного кода. Без Telegram id чата и администратора, без кода. ' +
      'Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: '{ link: {...} | null, pendingCode: { expiresAt } | null }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  setResponseHeader(event, 'cache-control', 'no-store')
  return telegramChatService.status(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
  )
})
