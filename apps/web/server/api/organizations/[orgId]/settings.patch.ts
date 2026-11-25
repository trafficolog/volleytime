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
              seoIndex: {
                type: 'boolean',
                description:
                  'индексация страницы группы; пока действует решение root (24.1.3) — 409 ' +
                  'group_page.moderation_locked',
              },
              publicPageEnabled: {
                type: 'boolean',
                description: 'публичная страница группы /{город}/{группа} (24.1.2, 24.2.1)',
              },
              slug: {
                type: 'string',
                description:
                  'slug группы в адресе /{город}/{группа} (24.2.1): a-z, 0-9, дефис, без двойных дефисов, ' +
                  'уникален; прежний адрес отвечает 301. Занятый — 409 organization.slug_taken',
              },
              city: {
                type: 'string',
                nullable: true,
                description:
                  'до 100 символов; город справочника даёт адрес /{город}/{группа} (24.2.1), ' +
                  'смена — 301 со старого адреса',
              },
              district: { type: 'string', nullable: true, description: 'до 100 символов' },
              levels: {
                type: 'array',
                items: { type: 'string', enum: ['v1', 'v2', 'v3', 'v4', 'v4_plus'] },
                description: 'уровни группы (несколько); повторы убираются, [] очищает',
              },
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
      409: {
        description:
          'seoIndex меняется, пока действует решение root по странице (group_page.moderation_locked); ' +
          'slug занят (organization.slug_taken)',
      },
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
