import { organizationSettingsService, requireOrgOwner } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Изменить настройки группы',
    description:
      'Частичное обновление (только владелец). Влияет на события, созданные после изменения: ' +
      'созданные события хранят снимок политики отмены. Изменённые поля пишутся в историю ' +
      '(audit_log, organization.settings_updated).',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              subscriptionsEnabled: { type: 'boolean' },
              maxSeatsPerBooking: { type: 'integer', minimum: 1, maximum: 10 },
              defaultPriceMode: { type: 'string', enum: ['fixed', 'split'] },
              defaultJoinMode: { type: 'string', enum: ['open', 'invite'] },
              cancellationAllowed: { type: 'boolean' },
              cancellationDeadlineHours: {
                type: 'integer',
                minimum: 0,
                maximum: 720,
                nullable: true,
                description: 'null: отмена до начала события',
              },
              seoIndex: { type: 'boolean' },
              city: { type: 'string', nullable: true, description: 'до 100 символов' },
              district: { type: 'string', nullable: true, description: 'до 100 символов' },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Обновлённые настройки: { settings } (как в GET)' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы или не владелец (forbidden.owner_only)' },
      404: { description: 'Группа не найдена (organization.not_found)' },
      410: { description: 'Группа в архиве (organization.archived)' },
      422: {
        description:
          'Значение вне допустимого (validation_failed) или пустой запрос (organization.invalid_settings)',
      },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const body = await readBody(event)
  const settings = await organizationSettingsService.update(
    ctx,
    event.context.organization!.id,
    body ?? {},
  )
  return { settings }
})
