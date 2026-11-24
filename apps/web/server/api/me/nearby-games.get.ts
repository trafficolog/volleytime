import { nearbyGamesService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['me'],
    summary: 'Открытые игры рядом',
    description:
      '30.3.3 (M-32): ближайшие открытые игры других публичных групп города. В ленте только ' +
      'опубликованные события, которые ещё не начались и открыты для записи (`joinMode = open`: ' +
      '«по приглашению» не попадают), и только группы с включённой публичной страницей, не скрытые ' +
      'root. Группы, где игрок активный участник, исключены. `level` — «мой уровень»: игры этого ' +
      'уровня и игры для любого уровня. Цен, состава и оплат в ответе нет. Запись выполняется на ' +
      'странице группы по её правилам.',
    parameters: [
      { name: 'city', in: 'query', required: true, schema: { type: 'string' } },
      {
        name: 'level',
        in: 'query',
        schema: { type: 'string', enum: ['v1', 'v2', 'v3', 'v4', 'v4_plus'] },
      },
      {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
    ],
    responses: {
      200: { description: '{ games: [...], hasMore }' },
      401: { description: 'Нет сессии' },
      422: { description: 'Нет города, неизвестный уровень или неверный limit/offset' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  return nearbyGamesService.list({ userId: user.id }, getQuery(event))
})
