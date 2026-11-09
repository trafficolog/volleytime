import { organizationBrandingService, requireOrgOwner } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Проверить короткую ссылку группы',
    description:
      '21.2.16. Только владелец. ?value= — адрес без `volleytime.by/`; тот же формат и список ' +
      'зарезервированных, что у PUT. Ответ { status: available | taken | reserved | invalid, value }. ' +
      'Собственный текущий адрес группы — available. Подсказка для поля ввода: окончательно решает ' +
      'PUT (409 при гонке).',
    parameters: [
      { in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } },
      { in: 'query', name: 'value', required: true, schema: { type: 'string' } },
    ],
    responses: {
      200: { description: '{ status, value }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не владелец группы (forbidden.owner_only)' },
      404: { description: 'Группа не найдена' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  const raw = getQuery(event).value
  return organizationBrandingService.checkShortLink(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    typeof raw === 'string' ? raw : '',
  )
})
