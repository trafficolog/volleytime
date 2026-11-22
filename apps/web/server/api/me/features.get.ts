import { playerFeaturesService } from '@volley-time/core'

defineRouteMeta({
  openAPI: {
    tags: ['me'],
    summary: 'Личные функции игрока',
    description:
      '23.1.1 (P-12): восемь флагов «Что показывать» (cal, coach, warmup, self, mvp, teams, streak, ' +
      'wrapped); по умолчанию включены. Не зависят от группы и устройства. Расписание, запись и ' +
      'оплата флагами не управляются.',
    responses: {
      200: {
        description: '{ features: { cal, coach, warmup, self, mvp, teams, streak, wrapped } }',
      },
      401: { description: 'Нет сессии' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const user = await requireAuth(event)
  return { features: await playerFeaturesService.get({ userId: user.id }) }
})
