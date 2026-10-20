import { requireCanManageContent, telegramChatService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['telegram-chat'],
    summary: 'Отвязать Telegram-чат группы',
    description:
      'Отвязка чата организатором (20.3.4) с записью в журнал; повтор безопасен (`unlinked: false`). ' +
      'Неиспользованный код привязки отзывается. Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: '{ unlinked: boolean }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  return telegramChatService.unlink(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
  )
})
