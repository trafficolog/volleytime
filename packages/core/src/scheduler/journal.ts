import {
  and,
  bookings,
  db as defaultDb,
  eq,
  events,
  inArray,
  scheduledJobs,
  sql,
  waitlistOffers,
  type DbOrTx,
} from '@volley-time/db'

import { notifierService } from '../notifier/service'
import type { NotificationType, TemplateParams } from '../notifier/templates'

/**
 * Проверка актуальности перед отправкой: состояние могло измениться между постановкой задачи и
 * доставкой (отмена записи, события, принятие предложения) — тогда задача `skipped`.
 * - `roster` — игрок всё ещё в составе (`confirmed`/`pending_payment`), событие не отменено и не началось;
 * - `event_open` — событие опубликовано и не началось;
 * - `offer` — предложение места ещё активно и не истекло.
 */
export type DeliveryCheck =
  | { kind: 'roster'; eventId: number; userId: number }
  | { kind: 'event_open'; eventId: number }
  | { kind: 'offer'; offerId: number }

export interface NotifyJobPayload {
  userId: number
  params: TemplateParams
  check?: DeliveryCheck
}

export interface NotifyJobInput extends NotifyJobPayload {
  type: NotificationType
  /** Ключ дедупликации: одна задача на ключ навсегда (ADR v3, «Лента уведомлений», формат ключа). */
  dedupKey: string
  organizationId?: number | null
  eventId?: number | null
  runAt?: Date
}

/** Попыток доставки до `failed` (1 + 5 повторов). */
export const MAX_ATTEMPTS = 6
/** Аренда захваченной задачи: после неё задачу упавшего экземпляра подхватывает другой. */
export const LEASE_MS = 2 * 60_000
const BACKOFF_BASE_MS = 30_000
const BACKOFF_MAX_MS = 30 * 60_000

/** Задержка перед повтором после `attempts` попыток: 30 с, 1, 2, 4, 8 мин … не больше 30 мин. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1))
}

/**
 * Поставить уведомление в журнал (в транзакции вызывающего — атомарно с изменением состояния).
 * Повтор с тем же ключом — no-op (`ON CONFLICT DO NOTHING`: строка журнала не денежная).
 * Возвращает true, если задача поставлена впервые.
 */
export async function enqueueNotification(db: DbOrTx, job: NotifyJobInput): Promise<boolean> {
  const payload: NotifyJobPayload = {
    userId: job.userId,
    params: job.params,
    ...(job.check ? { check: job.check } : {}),
  }
  const rows = await db
    .insert(scheduledJobs)
    .values({
      kind: job.type,
      dedupKey: job.dedupKey,
      organizationId: job.organizationId ?? null,
      eventId: job.eventId ?? null,
      payload,
      runAt: job.runAt ?? new Date(),
    })
    .onConflictDoNothing({ target: scheduledJobs.dedupKey })
    .returning({ id: scheduledJobs.id })
  return rows.length > 0
}

async function isActual(db: DbOrTx, check: DeliveryCheck | undefined, now: Date): Promise<boolean> {
  if (!check) return true
  if (check.kind === 'offer') {
    const [offer] = await db
      .select({ status: waitlistOffers.status, expiresAt: waitlistOffers.expiresAt })
      .from(waitlistOffers)
      .where(eq(waitlistOffers.id, check.offerId))
    return offer?.status === 'offered' && offer.expiresAt > now
  }
  const [event] = await db
    .select({ status: events.status, startsAt: events.startsAt })
    .from(events)
    .where(eq(events.id, check.eventId))
  if (!event || event.startsAt <= now) return false
  if (check.kind === 'event_open') return event.status === 'published'
  if (event.status !== 'published' && event.status !== 'closed') return false
  const [booking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.eventId, check.eventId),
        eq(bookings.userId, check.userId),
        inArray(bookings.status, ['confirmed', 'pending_payment']),
      ),
    )
  return booking !== undefined
}

interface ClaimedJob {
  id: number
  kind: string
  payload: NotifyJobPayload
  attempts: number
  lockedUntil: Date
}

/**
 * Захватить готовые задачи: `pending` с наступившим `run_at` и `running` с истёкшей арендой.
 * `FOR UPDATE SKIP LOCKED` — параллельные экземпляры получают непересекающиеся наборы.
 */
async function claimDueJobs(
  db: DbOrTx,
  now: Date,
  limit: number,
  leaseMs: number,
): Promise<ClaimedJob[]> {
  const lockedUntil = new Date(now.getTime() + leaseMs)
  const rows = await db.execute(sql`
    UPDATE ${scheduledJobs}
    SET status = 'running', locked_until = ${lockedUntil.toISOString()}::timestamptz, attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM ${scheduledJobs}
      WHERE (status = 'pending' AND run_at <= ${now.toISOString()}::timestamptz)
         OR (status = 'running' AND locked_until <= ${now.toISOString()}::timestamptz)
      ORDER BY run_at, id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind, payload, attempts`)
  return rows.map((r) => ({
    id: Number(r.id),
    kind: String(r.kind),
    payload: r.payload as NotifyJobPayload,
    attempts: Number(r.attempts),
    lockedUntil,
  }))
}

/**
 * Завершить задачу. Условие `status = 'running' AND attempts = claimed` — задачу, которую после
 * истечения аренды уже перехватил другой экземпляр, это завершение не перезаписывает.
 */
async function finish(
  db: DbOrTx,
  job: ClaimedJob,
  set: Partial<typeof scheduledJobs.$inferInsert>,
): Promise<void> {
  await db
    .update(scheduledJobs)
    .set({ lockedUntil: null, ...set })
    .where(
      and(
        eq(scheduledJobs.id, job.id),
        eq(scheduledJobs.status, 'running'),
        eq(scheduledJobs.attempts, job.attempts),
      ),
    )
}

/** Текст ошибки для журнала: без секретов и стека, ограниченной длины. */
function errorText(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  return message.slice(0, 500)
}

export interface DeliverySummary {
  sent: number
  skipped: number
  retried: number
  failed: number
}

/**
 * Доставить готовые уведомления журнала. Отправка — после фиксации захвата (не держит транзакцию
 * на время HTTP-запроса в бот). Сбой транспорта — повтор с backoff (`pending`, `run_at` позже),
 * после MAX_ATTEMPTS — `failed`. Гарантия — не более одной успешной отправки на ключ при штатной
 * работе; падение процесса между отправкой и отметкой даёт один повтор после аренды (at-least-once).
 */
export async function processDueJobs(
  opts: {
    now?: Date
    /** Размер пачки захвата: небольшой, чтобы задачи не ждали за чужой арендой. */
    batch?: number
    leaseMs?: number
    /** Бюджет времени доставки за проход: недоступный бот не задерживает переходы событий. */
    budgetMs?: number
    db?: DbOrTx
  } = {},
): Promise<DeliverySummary> {
  const db = opts.db ?? defaultDb
  // часы прохода: заданный `now` плюс прошедшее реальное время (свежий момент для аренды и backoff)
  const started = Date.now()
  const base = opts.now?.getTime() ?? started
  const clock = () => new Date(base + (Date.now() - started))
  const budgetMs = opts.budgetMs ?? 10_000
  const leaseMs = opts.leaseMs ?? LEASE_MS
  const summary: DeliverySummary = { sent: 0, skipped: 0, retried: 0, failed: 0 }
  const overBudget = () => Date.now() - started >= budgetMs
  while (!overBudget()) {
    const claimed = await claimDueJobs(db, clock(), opts.batch ?? 20, leaseMs)
    if (claimed.length === 0) break
    for (const [i, job] of claimed.entries()) {
      // бюджет исчерпан — оставшиеся захваченные задачи возвращаются без расхода попытки
      if (overBudget()) {
        await release(db, claimed.slice(i))
        return summary
      }
      // аренда истекла (долгая пачка): задачу мог перехватить другой экземпляр — не отправлять
      if (clock() >= job.lockedUntil) continue
      try {
        const { userId, params, check } = job.payload
        const delivered =
          (await isActual(db, check, clock())) &&
          (await notifierService.deliver(userId, job.kind as NotificationType, params))
        await finish(db, job, {
          status: delivered ? 'done' : 'skipped',
          completedAt: clock(),
          lastError: null,
        })
        if (delivered) summary.sent++
        else summary.skipped++
      } catch (e) {
        const terminal = job.attempts >= MAX_ATTEMPTS
        const at = clock()
        await finish(db, job, {
          status: terminal ? 'failed' : 'pending',
          runAt: terminal ? undefined : new Date(at.getTime() + backoffMs(job.attempts)),
          completedAt: terminal ? at : null,
          lastError: errorText(e),
        })
        if (terminal) {
          summary.failed++
          console.error('[scheduler] notification failed permanently', { jobId: job.id })
        } else summary.retried++
      }
    }
  }
  return summary
}

/** Вернуть захваченные, но не начатые задачи: `pending`, попытка не засчитывается. */
async function release(db: DbOrTx, jobs: ClaimedJob[]): Promise<void> {
  for (const job of jobs)
    await db
      .update(scheduledJobs)
      .set({ status: 'pending', lockedUntil: null, attempts: job.attempts - 1 })
      .where(
        and(
          eq(scheduledJobs.id, job.id),
          eq(scheduledJobs.status, 'running'),
          eq(scheduledJobs.attempts, job.attempts),
        ),
      )
}

/** Срок хранения завершённых задач журнала. */
export const JOURNAL_RETENTION_MS = 90 * 24 * 3600_000

/**
 * Очистка завершённых задач старше 90 дней. Безопасна для дедупликации: ключ задачи может быть
 * поставлен повторно только в своём окне (напоминание — до начала события, «запись открыта» — в
 * течение суток после открытия, предложение и фиксация — один раз), а через 90 дней после
 * завершения окно давно прошло.
 */
export async function purgeCompletedJobs(now: Date, limit = 1000): Promise<number> {
  const before = new Date(now.getTime() - JOURNAL_RETENTION_MS).toISOString()
  const rows = await defaultDb.execute(sql`
    DELETE FROM ${scheduledJobs} WHERE id IN (
      SELECT id FROM ${scheduledJobs}
      WHERE status IN ('done', 'skipped', 'failed') AND completed_at < ${before}::timestamptz
      LIMIT ${limit}
    )
    RETURNING id`)
  return rows.length
}
