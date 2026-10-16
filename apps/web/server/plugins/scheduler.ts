import { createSchedulerRunner, isSchedulerEnabled, runSchedulerTick } from '@volley-time/core'

import { schedulerIntervalMs } from '../utils/scheduler-config'

/**
 * Планировщик фоновых задач события (20.3.1, P-04): цикл в web-процессе, только при
 * `SCHEDULER_ENABLED=true` (флаг выкладки, ADR v3 п. 4). Несколько экземпляров web безопасны —
 * задачи берутся `SKIP LOCKED`, переходы событий идут под advisory-lock события. При остановке
 * сервера текущий проход дожидается (graceful shutdown).
 */
export default defineNitroPlugin((nitro) => {
  if (!isSchedulerEnabled(process.env.SCHEDULER_ENABLED)) return
  const runner = createSchedulerRunner({
    intervalMs: schedulerIntervalMs(process.env.SCHEDULER_INTERVAL_MS),
    tick: () => runSchedulerTick(),
    onError: (e) => console.error('[scheduler] tick failed', e),
  })
  runner.start()
  console.info('[scheduler] started')
  nitro.hooks.hook('close', () => runner.stop())
})
