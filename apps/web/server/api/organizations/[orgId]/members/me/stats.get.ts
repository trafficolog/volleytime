import { playerStatsService, requireOrgMember } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['members'],
    summary: 'Моя статистика посещений в группе',
    description:
      '21.4.8 (M-13). Только свои данные активного участника группы: посещения, неявки и доля ' +
      'посещаемости за окно по умолчанию (последние 90 дней группы) — теми же агрегатами, что ' +
      'список игроков организатора (21.2.20). Параметры запроса игнорируются; долг, абонемент и ' +
      'чужие игроки в ответ не входят.',
    parameters: [{ in: 'path', name: 'orgId', required: true, schema: { type: 'integer' } }],
    responses: {
      200: {
        description:
          '{ attendance: { visits, noShows, ratePercent | null }, period: { from, to } }',
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Не участник группы или заявка не одобрена' },
      404: { description: 'Группа не найдена (organization.not_found)' },
    },
  },
})

/** Профиль игрока: org-scope → активный участник → агрегаты только для `ctx.userId`. */
export default defineApiHandler(async (event) => {
  requireOrgMember(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const result = await playerStatsService.getForUsers(ctx, event.context.organization!.id, [
    ctx.userId,
  ])
  const { visits, noShows, ratePercent } = result.byUser.get(ctx.userId)!.attendance
  setResponseHeader(event, 'cache-control', 'no-store')
  return { attendance: { visits, noShows, ratePercent }, period: result.period }
})
