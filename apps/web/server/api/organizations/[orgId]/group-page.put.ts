import { groupPageService, requireOrgOwner } from '@volley-time/core'

// defineRouteMeta разбирается Nitro статически: схема описывается литералом прямо здесь.
defineRouteMeta({
  openAPI: {
    tags: ['organizations'],
    summary: 'Сохранить страницу группы',
    description:
      'Полная замена содержимого (только владелец, D-24): восемь секций ровно по одному разу в ' +
      'порядке показа, metaTitle и metaDescription (null — по умолчанию). Предупреждения мета ' +
      'сохранение не блокируют. Индексация меняется через PATCH …/settings { seoIndex }.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['sections', 'metaTitle', 'metaDescription'],
            properties: {
              sections: {
                type: 'array',
                minItems: 8,
                maxItems: 8,
                description:
                  'cover {headline ≤80, subtitle ≤160}, about {text ≤2000}, schedule {}, ' +
                  'formats {text ≤1000}, prices {text ≤1000}, venues {venueIds ≤10, активные залы ' +
                  'группы}, join {text ≤1000, null — по режиму записи}, faq {items ≤15: question ' +
                  '≤200, answer ≤1000}; у каждой kind и enabled',
                items: { type: 'object' },
              },
              metaTitle: { type: 'string', nullable: true, description: 'до 120 символов' },
              metaDescription: { type: 'string', nullable: true, description: 'до 320 символов' },
            },
          },
        },
      },
    },
    responses: {
      200: { description: 'Сохранённая страница: { page } (как в GET)' },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы или не владелец (forbidden.owner_only)' },
      404: { description: 'Группа не найдена (organization.not_found)' },
      410: { description: 'Группа в архиве (organization.archived)' },
      422: {
        description:
          'Нарушена форма или лимит (validation_failed) или зал не из группы (group_page.venue_invalid)',
      },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireOrgOwner(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const body = await readBody(event)
  const page = await groupPageService.update(ctx, event.context.organization!.id, body ?? {})
  return { page }
})
