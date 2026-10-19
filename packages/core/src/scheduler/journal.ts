import {
  and,
  bookings,
  db as defaultDb,
  eq,
  events,
  inArray,
  notifications,
  organizations,
  scheduledJobs,
  sql,
  users,
  waitlistOffers,
  type DbOrTx,
} from '@volley-time/db'

import { DeliveryError } from '../notifier/delivery-error'
import { FEED_TYPE, feedKeyOf, isCriticalNotification } from '../notifier/feed-types'
import { quietHoursEnd } from '../notifier/quiet-hours'
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
  /** Запись ленты (20.3.2), итог доставки которой фиксируется; нет — задача без ленты. */
  notificationId?: number
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
  return (await enqueueNotifications(db, [job])) > 0
}

const ENQUEUE_CHUNK = 500

/**
 * Пачка уведомлений (20.3.2): для типов ленты сначала запись `notifications` (один источник для
 * бота, Mini App и кабинета; `UNIQUE (recipient_user_id, dedup_key)` — не больше одного уведомления
 * типа на событие), затем задача доставки в журнале с её `notificationId`. Запись ленты уже есть —
 * задача не ставится (повторная постановка не дублирует сообщение). Задача журнала уже есть — только что
 * созданная запись ленты удаляется, чтобы не остаться без доставки. Возвращает число поставленных задач.
 */
export async function enqueueNotifications(db: DbOrTx, jobs: NotifyJobInput[]): Promise<number> {
  let queued = 0
  for (let i = 0; i < jobs.length; i += ENQUEUE_CHUNK) {
    const chunk = jobs.slice(i, i + ENQUEUE_CHUNK)
    queued += await db.transaction((tx) => enqueueChunk(tx, chunk))
  }
  return queued
}

async function enqueueChunk(tx: DbOrTx, chunk: NotifyJobInput[]): Promise<number> {
  const feedKey = (j: NotifyJobInput) => `${j.userId}|${feedKeyOf(j.type, j.dedupKey)}`
  const feedable = chunk.filter((j) => FEED_TYPE[j.type])
  const created = new Map<string, number>() // получатель|ключ ленты -> id записи
  if (feedable.length > 0) {
    const rows = await tx
      .insert(notifications)
      .values(
        feedable.map((j) => ({
          recipientUserId: j.userId,
          organizationId: j.organizationId ?? null,
          eventId: j.eventId ?? null,
          type: FEED_TYPE[j.type]!,
          dedupKey: feedKeyOf(j.type, j.dedupKey),
          // данные шаблона: без секретов и initData (параметры — названия, суммы, идентификаторы)
          payload: { template: j.type, params: j.params },
        })),
      )
      .onConflictDoNothing({ target: [notifications.recipientUserId, notifications.dedupKey] })
      .returning({
        id: notifications.id,
        recipientUserId: notifications.recipientUserId,
        dedupKey: notifications.dedupKey,
      })
    for (const r of rows) created.set(`${r.recipientUserId}|${r.dedupKey}`, r.id)
  }
  const toQueue = chunk.filter((j) => !FEED_TYPE[j.type] || created.has(feedKey(j)))
  if (toQueue.length === 0) return 0
  const inserted = await tx
    .insert(scheduledJobs)
    .values(
      toQueue.map((j) => {
        const notificationId = created.get(feedKey(j))
        const payload: NotifyJobPayload = {
          userId: j.userId,
          params: j.params,
          ...(j.check ? { check: j.check } : {}),
          ...(notificationId ? { notificationId } : {}),
        }
        return {
          kind: j.type,
          dedupKey: j.dedupKey,
          organizationId: j.organizationId ?? null,
          eventId: j.eventId ?? null,
          payload,
          runAt: j.runAt ?? new Date(),
        }
      }),
    )
    .onConflictDoNothing({ target: scheduledJobs.dedupKey })
    .returning({ dedupKey: scheduledJobs.dedupKey })
  const queuedKeys = new Set(inserted.map((r) => r.dedupKey))
  const orphans = toQueue
    .filter((j) => !queuedKeys.has(j.dedupKey))
    .map((j) => created.get(feedKey(j)))
    .filter((id): id is number => id !== undefined)
  if (orphans.length > 0) await tx.delete(notifications).where(inArray(notifications.id, orphans))
  return inserted.length
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
  organizationId: number | null
  payload: NotifyJobPayload
  attempts: number
  lockedUntil: Date
  runAt: number
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
    RETURNING id, kind, organization_id, payload, attempts, run_at`)
  // RETURNING не гарантирует порядок подзапроса: доставка идёт по времени постановки
  return rows
    .map((r) => ({
      id: Number(r.id),
      kind: String(r.kind),
      organizationId: r.organization_id === null ? null : Number(r.organization_id),
      payload: r.payload as NotifyJobPayload,
      attempts: Number(r.attempts),
      lockedUntil,
      runAt: new Date(r.run_at as string | Date).getTime(),
    }))
    .sort((a, b) => a.runAt - b.runAt || a.id - b.id)
}

/**
 * Завершить задачу. Условие `status = 'running' AND attempts = claimed` — задачу, которую после
 * истечения аренды уже перехватил другой экземпляр, это завершение не перезаписывает.
 */
async function finish(
  db: DbOrTx,
  job: ClaimedJob,
  set: Partial<typeof scheduledJobs.$inferInsert>,
): Promise<boolean> {
  const rows = await db
    .update(scheduledJobs)
    .set({ lockedUntil: null, ...set })
    .where(
      and(
        eq(scheduledJobs.id, job.id),
        eq(scheduledJobs.status, 'running'),
        eq(scheduledJobs.attempts, job.attempts),
      ),
    )
    .returning({ id: scheduledJobs.id })
  return rows.length > 0
}

/** Итог доставки в записи ленты (20.3.2): только пока задача принадлежит этому экземпляру. */
async function noteDelivery(
  db: DbOrTx,
  job: ClaimedJob,
  set: Partial<typeof notifications.$inferInsert>,
): Promise<void> {
  const id = job.payload.notificationId
  if (!id) return
  await db
    .update(notifications)
    .set({ attempts: job.attempts, ...set })
    .where(eq(notifications.id, id))
}

/** Сколько заблокировавшему бота пользователю не отправляем, прежде чем попробовать снова. */
export const UNREACHABLE_COOLDOWN_MS = 7 * 24 * 3600_000
/** Часовой пояс по умолчанию для тихих часов, если группы нет (как `organizations.default_timezone`). */
const DEFAULT_TIMEZONE = 'Europe/Minsk'
/** Пауза между отправками: ≤ 25 сообщений/с при общем лимите Bot API около 30/с. */
export const DEFAULT_PACE_MS = 40

type Gate =
  | { action: 'send'; wasBlocked: boolean }
  | { action: 'skip'; reason: string }
  | { action: 'defer'; until: Date }

/**
 * Решение перед отправкой (20.3.2): получатель недоступен (бот заблокирован) — пропуск; тихие часы
 * получателя в часовом поясе группы-источника откладывают всё, кроме критичных уведомлений.
 */
async function deliveryGate(db: DbOrTx, job: ClaimedJob, now: Date): Promise<Gate> {
  const [user] = await db
    .select({
      botBlockedAt: users.botBlockedAt,
      quietHoursStart: users.quietHoursStart,
      quietHoursEnd: users.quietHoursEnd,
    })
    .from(users)
    .where(eq(users.id, job.payload.userId))
  if (!user) return { action: 'skip', reason: 'no_user' }
  const wasBlocked = user.botBlockedAt !== null
  const critical = isCriticalNotification(job.kind as NotificationType)
  // критичные всегда пробуют отправиться: отметка могла устареть (пользователь вернулся), а потеря
  // места из очереди или сообщения об оплате дороже одной лишней попытки
  if (
    !critical &&
    user.botBlockedAt &&
    now.getTime() - user.botBlockedAt.getTime() < UNREACHABLE_COOLDOWN_MS
  )
    return { action: 'skip', reason: 'bot_unreachable' }
  if (!critical) {
    let timeZone = DEFAULT_TIMEZONE
    if (job.organizationId !== null) {
      const [org] = await db
        .select({ tz: organizations.defaultTimezone })
        .from(organizations)
        .where(eq(organizations.id, job.organizationId))
      if (org) timeZone = org.tz
    }
    const until = quietHoursEnd(
      now,
      { start: user.quietHoursStart, end: user.quietHoursEnd },
      timeZone,
    )
    // напоминание полезно только до начала: если окно кончается позже, шлём сразу
    const startsAt = job.kind.startsWith('reminder_') ? job.payload.params.eventDate : undefined
    if (until && !(startsAt && until.getTime() >= new Date(startsAt).getTime()))
      return { action: 'defer', until }
  }
  return { action: 'send', wasBlocked }
}

/** Отложить задачу без расхода попытки (тихие часы, лимит Bot API). */
async function defer(db: DbOrTx, job: ClaimedJob, until: Date): Promise<void> {
  await finish(db, job, { status: 'pending', runAt: until, attempts: job.attempts - 1 })
}

/** Пометить получателя недоступным: доставка пропускается, пока он не напишет боту или не пройдёт срок. */
async function markUnreachable(db: DbOrTx, userId: number, at: Date): Promise<void> {
  await db.update(users).set({ botBlockedAt: at }).where(eq(users.id, userId))
}

let rateLimitedUntil = 0
/** Сброс общего состояния лимита (тесты). */
export function resetDeliveryPacing(): void {
  rateLimitedUntil = 0
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
  /** Отложено без расхода попытки: тихие часы получателя или лимит Bot API. */
  deferred: number
  /** Получатель недоступен (бот заблокирован): не отправлено, не повторяется. */
  unreachable: number
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
    /** Пауза между отправками в Telegram (лимит Bot API); тесты задают 0. */
    paceMs?: number
  } = {},
): Promise<DeliverySummary> {
  const db = opts.db ?? defaultDb
  // часы прохода: заданный `now` плюс прошедшее реальное время (свежий момент для аренды и backoff)
  const started = Date.now()
  const base = opts.now?.getTime() ?? started
  const clock = () => new Date(base + (Date.now() - started))
  const budgetMs = opts.budgetMs ?? 10_000
  const leaseMs = opts.leaseMs ?? LEASE_MS
  const paceMs = opts.paceMs ?? DEFAULT_PACE_MS
  const summary: DeliverySummary = {
    sent: 0,
    skipped: 0,
    retried: 0,
    failed: 0,
    deferred: 0,
    unreachable: 0,
  }
  const overBudget = () => Date.now() - started >= budgetMs
  // Telegram ответил 429: до `retry_after` ничего не отправляем (общий лимит бота, не получателя)
  if (clock().getTime() < rateLimitedUntil) return summary
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
        const skip = async (reason: string, counter: 'skipped' | 'unreachable' = 'skipped') => {
          const at = clock()
          if (await finish(db, job, { status: 'skipped', completedAt: at, lastError: reason }))
            await noteDelivery(db, job, { deliveryStatus: 'skipped', lastError: reason })
          summary[counter]++
        }
        if (!(await isActual(db, check, clock()))) {
          await skip('stale')
          continue
        }
        const gate = await deliveryGate(db, job, clock())
        if (gate.action === 'skip') {
          await skip(gate.reason, gate.reason === 'bot_unreachable' ? 'unreachable' : 'skipped')
          continue
        }
        if (gate.action === 'defer') {
          await defer(db, job, gate.until)
          summary.deferred++
          continue
        }
        const delivered = await notifierService.deliver(
          userId,
          job.kind as NotificationType,
          params,
        )
        const at = clock()
        if (
          await finish(db, job, {
            status: delivered ? 'done' : 'skipped',
            completedAt: at,
            lastError: delivered ? null : 'no_telegram',
          })
        ) {
          await noteDelivery(db, job, {
            deliveryStatus: delivered ? 'sent' : 'skipped',
            deliveredAt: delivered ? at : null,
            lastError: delivered ? null : 'no_telegram',
          })
          if (delivered && gate.wasBlocked)
            await db.update(users).set({ botBlockedAt: null }).where(eq(users.id, userId))
        }
        if (delivered) {
          summary.sent++
          if (paceMs > 0) await new Promise((r) => setTimeout(r, paceMs))
        } else summary.skipped++
      } catch (e) {
        if (e instanceof DeliveryError && e.kind === 'blocked') {
          // бот заблокирован / чат недоступен: повтор бессмыслен, получатель помечается недоступным
          const at = clock()
          await markUnreachable(db, job.payload.userId, at)
          if (
            await finish(db, job, { status: 'skipped', completedAt: at, lastError: 'bot_blocked' })
          )
            await noteDelivery(db, job, { deliveryStatus: 'failed', lastError: 'bot_blocked' })
          summary.unreachable++
          continue
        }
        if (e instanceof DeliveryError && e.kind === 'rate_limited') {
          // лимит Bot API: задача и остаток пачки ждут `retry_after`, попытка не засчитывается
          const until = new Date(clock().getTime() + (e.retryAfterMs ?? 30_000))
          rateLimitedUntil = until.getTime()
          await defer(db, job, until)
          await release(db, claimed.slice(i + 1))
          summary.deferred++
          return summary
        }
        const terminal = job.attempts >= MAX_ATTEMPTS
        const at = clock()
        const message = errorText(e)
        if (
          await finish(db, job, {
            status: terminal ? 'failed' : 'pending',
            runAt: terminal ? undefined : new Date(at.getTime() + backoffMs(job.attempts)),
            completedAt: terminal ? at : null,
            lastError: message,
          })
        )
          await noteDelivery(db, job, {
            deliveryStatus: terminal ? 'failed' : 'pending',
            lastError: message,
          })
        if (terminal) {
          summary.failed++
          console.error('[scheduler] notification failed permanently', { jobId: job.id })
        } else {
          summary.retried++
          // без текста ошибки и данных получателя: только идентификатор задачи и номер попытки
          console.warn('[scheduler] notification delivery failed, will retry', {
            jobId: job.id,
            attempt: job.attempts,
          })
        }
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
