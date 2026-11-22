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
      'Совокупность — игроки платформы (активные участники живых групп); записи — только в живых ' +
      'группах. Метрики: `disabledShare` — доля игроков, выключивших функцию; `weeklyActive` — ' +
      'игроки с событием за 7 суток; `retention` — когорта: первое открытие в окне ' +
      '[now−56d, now−28d) (более ранние открытия не учитываются), доля записавшихся на игру в 28 ' +
      'суток после него; `bookingFrequency.on/off` — записей на игрока за 28 суток с включённой и ' +
      'выключенной функцией. Если выключивших или включённых меньше 10, скрываются `disabledShare` ' +
      'и обе стороны `bookingFrequency`.',
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
