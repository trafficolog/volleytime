import { expireDueOffers } from '../bookings/offers'
import { closeDueEvents, type CloseSummary } from '../events/auto-close'

import { enqueueBookingOpened, enqueueReminders } from './event-notifications'
import { processDueJobs, purgeCompletedJobs, type DeliverySummary } from './journal'

const PURGE_INTERVAL_MS = 3600_000
let lastPurgeAt = 0

export interface TickSummary {
  expiredOffers: number
  close: CloseSummary
  enqueued: number
  delivery: DeliverySummary | null
  errors: string[]
}

/**
 * Один проход планировщика (20.3.1). Все переходы выводятся из состояния БД на момент `now`, поэтому
 * проход переживает перезапуск (расписание не хранится отдельно и не теряется), повторный и
 * параллельный проходы идемпотентны. Порядок: истечение предложений → закрытие записи (и фиксация
 * split) → постановка «запись открыта» и напоминаний → доставка журнала → очистка журнала старше
 * 90 дней. Сбой шага не останавливает остальные.
 */
export async function runSchedulerTick(
  opts: { now?: Date; deliver?: boolean } = {},
): Promise<TickSummary> {
  const now = opts.now ?? new Date()
  const summary: TickSummary = {
    expiredOffers: 0,
    close: { closed: 0, settled: 0, skipped: 0 },
    enqueued: 0,
    delivery: null,
    errors: [],
  }
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      summary.errors.push(name)
      console.error(`[scheduler] ${name} failed`, e)
    }
  }
  await step('offers.expire', async () => {
    summary.expiredOffers = await expireDueOffers(now)
  })
  await step('events.close', async () => {
    summary.close = await closeDueEvents(now)
  })
  await step('notify.booking_opened', async () => {
    summary.enqueued += await enqueueBookingOpened(now)
  })
  await step('notify.reminders', async () => {
    summary.enqueued += await enqueueReminders(now)
  })
  if (opts.deliver !== false)
    await step('notify.deliver', async () => {
      summary.delivery = await processDueJobs({ now })
    })
  // очистка — не чаще раза в час на процесс (индекс по completed_at, ревью PR #150)
  if (now.getTime() - lastPurgeAt >= PURGE_INTERVAL_MS) {
    lastPurgeAt = now.getTime()
    await step('journal.purge', async () => {
      await purgeCompletedJobs(now)
    })
  }
  return summary
}
