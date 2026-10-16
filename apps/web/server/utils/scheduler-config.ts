import { DEFAULT_INTERVAL_MS } from '@volley-time/core'

/** `SCHEDULER_INTERVAL_MS` → интервал прохода планировщика: 1–60 с, по умолчанию 15 с (20.3.1). */
export function schedulerIntervalMs(value: string | undefined): number {
  const n = Number(value)
  if (value === undefined || value === '' || !Number.isFinite(n) || n <= 0)
    return DEFAULT_INTERVAL_MS
  return Math.min(60_000, Math.max(1_000, Math.round(n)))
}
