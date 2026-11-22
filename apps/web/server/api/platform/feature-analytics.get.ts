import { featureAnalyticsService } from '@volley-time/core'

const metric = {
  type: 'object',
  properties: {
    players: { type: 'integer', nullable: true },
    value: { type: 'number', nullable: true },
    suppressed: { type: 'boolean' },
  },
} as const

defineRouteMeta({
  openAPI: {
    tags: ['platform'],
    summary: 'Аналитика функций игрока',
    description:
      '23.1.2 (P-14, D-25): метрики успеха восьми личных функций по всей платформе. Только Root ' +
      'Admin; администраторы групп доступа не имеют. Только агрегаты: без игроков и групп. ' +
      'Когорта меньше `minCohort` (10) скрывается: `suppressed: true`, `players` и `value` — null. ' +
      'Метрики: `disabledShare` — доля игроков, выключивших функцию; `weeklyActive` — игроки с ' +
      'событием за 7 суток; `retention` — доля открывших функцию в окне [now−56 сут, now−28 сут), ' +
      'кто записался на игру в 28 суток после первого открытия; `bookingFrequency.on/off` — записей ' +
      'на игрока за 28 суток с включённой и выключенной функцией.',
    responses: {
      200: {
        description: 'Отчёт',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                generatedAt: { type: 'string', format: 'date-time' },
                minCohort: { type: 'integer' },
                retentionDays: { type: 'integer' },
                windows: {
                  type: 'object',
                  properties: {
                    activeDays: { type: 'integer' },
                    retentionDays: { type: 'integer' },
                    frequencyDays: { type: 'integer' },
                  },
                },
                players: { type: 'integer', nullable: true },
                features: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      feature: { type: 'string' },
                      disabledShare: metric,
                      weeklyActive: metric,
                      retention: metric,
                      bookingFrequency: {
                        type: 'object',
                        properties: { on: metric, off: metric },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: 'Нет сессии' },
      403: { description: 'Не Root Admin (forbidden.root_only)' },
    },
  },
})

/** Вне tenant-префикса: пользователь — из `requireRootAdmin`, роль проверяется и в сервисе. */
export default defineApiHandler(async (event) => {
  const user = await requireRootAdmin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return featureAnalyticsService.report({ userId: user.id })
})
