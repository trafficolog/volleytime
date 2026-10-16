/** Интервал прохода по умолчанию: предложение места и его истечение обрабатываются < 1 мин (P-04). */
export const DEFAULT_INTERVAL_MS = 15_000

export interface SchedulerRunner {
  start: () => void
  /** Остановить цикл и дождаться текущего прохода (graceful shutdown). */
  stop: () => Promise<void>
}

/**
 * Цикл планировщика в процессе приложения: следующий проход — через `intervalMs` после окончания
 * предыдущего (проходы одного процесса не перекрываются). Несколько процессов безопасны: задачи
 * берутся `SKIP LOCKED`, переходы событий — под advisory-lock. Ошибка прохода не останавливает цикл.
 */
export function createSchedulerRunner(opts: {
  tick: () => Promise<unknown>
  intervalMs?: number
  onError?: (error: unknown) => void
}): SchedulerRunner {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS
  let timer: ReturnType<typeof setTimeout> | null = null
  let current: Promise<void> | null = null
  let stopped = true

  const schedule = () => {
    if (stopped) return
    timer = setTimeout(run, intervalMs)
  }
  const run = () => {
    timer = null
    current = opts
      .tick()
      .then(
        () => undefined,
        (e: unknown) => opts.onError?.(e),
      )
      .finally(() => {
        current = null
        schedule()
      })
  }

  return {
    start() {
      if (!stopped) return
      stopped = false
      schedule()
    },
    async stop() {
      stopped = true
      if (timer) clearTimeout(timer)
      timer = null
      if (current) await current
    },
  }
}
