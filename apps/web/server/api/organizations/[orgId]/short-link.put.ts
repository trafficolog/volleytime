import { organizationBrandingService, requireOrgOwner } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Задать короткую ссылку группы',
    description:
      '21.2.16. `volleytime.by/<имя>`: 3-32 знака, строчные латинские буквы, цифры и дефис (дефис ' +
      'не в начале, не в конце и не двойной); регистр приводится к строчному. null снимает ссылку. ' +
      'Зарезервированные слова (app, m, api, admin, login и маршруты приложения) — 422 ' +
      '(short_link.reserved), занятый адрес — 409 (short_link.taken). Отдельное значение, не slug ' +
      'группы. Текущее значение читается из GET /api/organizations/{orgId} (organization.shortLink). ' +
      'Публичную страницу по адресу строит 24.1.2. Только владелец (решение владельца 2026-11-09).',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: { shortLink: { type: 'string', nullable: true } },
            required: ['shortLink'],
          },
        },
      },
    },
    responses: {
      200: { description: '{ shortLink: string | null }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не владелец группы (forbidden.owner_only)' },
      404: { description: 'Группа не найдена' },
      409: { description: 'Адрес занят (short_link.taken)' },
      410: { description: 'Группа в архиве (organization.archived)' },
      422: { description: 'Формат или зарезервированное слово (short_link.invalid / reserved)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  const body = await readBody(event)
  return organizationBrandingService.setShortLink(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    body ?? {},
  )
})
