import { playerCalendarService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['me'],
    summary: 'Общий календарь игрока',
    description:
      '23.2.2 (M-10): игры всех групп, где игрок активный участник, одним ответом. `from`/`to` — ' +
      'даты YYYY-MM-DD (обе включительно, до 62 дней), границы дней — по часовому поясу каждой группы. ' +
      'Без черновиков и отменённых; цен, платежей и состава нет, только своя запись и занятые места. ' +
      'Не зависит от флага `cal`: флаг скрывает вкладку, расписание не выключается.',
    parameters: [
      { name: 'from', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
    ],
    responses: {
      200: { description: '{ groups: [{ id, name, timezone, logoUpdatedAt }], events: [...] }' },
      401: { description: 'Нет сессии' },
      422: { description: 'Нет или неверный диапазон (validation_failed)' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  return playerCalendarService.list({ userId: user.id }, getQuery(event))
})
