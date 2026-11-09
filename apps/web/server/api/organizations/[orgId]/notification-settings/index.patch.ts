import { groupNotificationSettingsService, requireCanManageContent } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['notification-settings'],
    summary: 'Изменить переключатели уведомлений группы',
    description:
      '21.2.14: частичное обновление { reminder_24h?, reminder_2h? }. Выключенный тип не уходит ' +
      'игрокам этой группы; лента в приложении не меняется. Обязательные типы выключить нельзя ' +
      '(notification_settings.mandatory). Изменения пишутся в историю (organization.notifications_updated). ' +
      'Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              reminder_24h: { type: 'boolean' },
              reminder_2h: { type: 'boolean' },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Обновлённый список: { notifications } (как в GET)' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      422: {
        description:
          'Обязательный тип (notification_settings.mandatory), неизвестный ключ (validation_failed) или пустой запрос (notification_settings.empty)',
      },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const body = await readBody(event)
  const notifications = await groupNotificationSettingsService.update(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    body ?? {},
  )
  return { notifications }
})
