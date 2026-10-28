import { collectionService, requireCanManageContent } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['collections'],
    summary: 'Создать сбор',
    description:
      '21.2.4: название (1–120), описание, иконка (ball, trophy, shirt, arena, party, bus), цель в ' +
      'минимальных единицах или null (без цели), дедлайн в будущем; status draft или active ' +
      '(по умолчанию active — виден игрокам). Валюта — валюта группы. Только при ' +
      'COLLECTIONS_ENABLED=true. Владелец и организатор.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['title'],
            properties: {
              title: { type: 'string' },
              description: { type: 'string', nullable: true },
              icon: { type: 'string', enum: ['ball', 'trophy', 'shirt', 'arena', 'party', 'bus'] },
              targetAmount: { type: 'integer', minimum: 1, nullable: true },
              deadlineAt: { type: 'string', format: 'date-time', nullable: true },
              status: { type: 'string', enum: ['draft', 'active'] },
            },
          },
        },
      },
    },
    responses: {
      200: { description: '{ collection }' },
      401: { description: 'Нет сессии' },
      403: { description: 'Роль ниже организатора (forbidden.manage_content)' },
      409: { description: 'Сборы выключены (collection.disabled)' },
      422: { description: 'Неверное тело (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const collection = await collectionService.create(
    createServiceContextFromEvent(event),
    event.context.organization!.id,
    (await readBody(event)) ?? {},
  )
  return { collection }
})
