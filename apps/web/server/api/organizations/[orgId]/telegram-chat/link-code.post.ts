import { requireCanManageContent, telegramChatService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['telegram-chat'],
    summary: 'Код привязки Telegram-чата',
    description:
      'Выдаёт одноразовый код (20.3.4) со сроком 15 минут, привязанный к этой группе; предыдущий ' +
      'неиспользованный код отзывается. Код показывается один раз. Чтобы привязать чат, администратор ' +
      'чата отправляет в нём `/link <код>`. Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: '{ code, expiresAt, command }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      409: { description: 'У группы уже есть чат (telegram_chat.group_has_chat)' },
      429: { description: 'Слишком много запросов' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const orgId = event.context.organization!.id
  limitOrgChatAction(event, `code:${orgId}`)
  const { code, expiresAt } = await telegramChatService.issueCode(
    createServiceContextFromEvent(event),
    orgId,
  )
  setResponseHeader(event, 'cache-control', 'no-store')
  return { code, expiresAt, command: `/link ${code}` }
})
