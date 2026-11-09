import { groupNotificationSettingsService, requireCanManageContent } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['notification-settings'],
    summary: 'Переключатели уведомлений группы',
    description:
      '21.2.14: какие уведомления бот присылает игрокам группы. Напоминания переключаются ' +
      '(по умолчанию включены), обязательные типы всегда включены (mandatory: true). Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: '{ notifications: [{ type, enabled, mandatory }] }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const notifications = await groupNotificationSettingsService.list(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
  )
  return { notifications }
})
