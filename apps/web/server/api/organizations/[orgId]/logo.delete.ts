import { organizationBrandingService, requireCanManageContent } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Удалить логотип группы',
    description:
      '21.2.16. Удаляет логотип; в приложении снова показывается монограмма. Пишет audit ' +
      'organization.logo_removed. Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: { description: '{ ok: true }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      404: { description: 'Группа не найдена или логотипа нет (logo.not_found)' },
      410: { description: 'Группа в архиве (organization.archived)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  await organizationBrandingService.removeLogo(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
  )
  return { ok: true }
})
