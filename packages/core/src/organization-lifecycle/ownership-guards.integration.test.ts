import { closeDb, db, eq, events, organizations, sql, users, waitlistOffers } from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { offerFreeSeatsSweep } from '../bookings/offers'
import { bookingService } from '../bookings/service'
import { closeDueEvents } from '../events/auto-close'
import { eventService } from '../events/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

import { organizationDeletionService, ownershipTransferService } from './service'

/**
 * Task 21.2.17, ревью PR #239: проверки под блокировкой, которые не видны HTTP-тестам.
 * 1) Прежний owner с устаревшим tenant (прошёл requireOrgOwner до принятия) не выполняет действий
 *    владельца: сервис перепроверяет роль под блокировкой группы.
 * 2) Фоновые задачи, выбравшие событие до коммита удаления, перепроверяют группу под блокировкой
 *    её строки и событие не трогают. Удаление удерживается на записи в журнал (`LOCK audit_log`).
 */
describe('ownership and deletion re-checks under lock (PostgreSQL)', { timeout: 30_000 }, () => {
  let owner: number
  let recipient: number
  let orgId: number
  let recipientMemberId: number

  const newUser = async (tag: string) =>
    (
      await db
        .insert(users)
        .values({ email: `guard-${tag}-${crypto.randomUUID()}@t.by` })
        .returning()
    )[0]!.id

  async function waiters(n: number) {
    const deadline = Date.now() + 10_000
    for (;;) {
      const [row] = await db.execute(
        sql`SELECT count(DISTINCT pid)::int AS n FROM pg_locks WHERE NOT granted`,
      )
      if (Number(row!.n) >= n) return
      if (Date.now() > deadline) throw new Error(`expected ${n} lock waiters`)
      await new Promise((r) => setTimeout(r, 20))
    }
  }

  /** Удаление группы, остановленное на записи в журнал: строка группы уже заблокирована и изменена. */
  async function deletionInFlight() {
    let release!: () => void
    let ready!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const locked = new Promise<void>((r) => (ready = r))
    const holder = db.transaction(async (tx) => {
      await tx.execute(sql`LOCK TABLE audit_log IN SHARE MODE`)
      ready()
      await gate
    })
    await locked
    const deletion = organizationDeletionService.delete({ userId: owner }, orgId, {
      confirmName: 'Guards',
    })
    await waiters(1)
    return {
      async finish() {
        release()
        await holder
        await deletion
      },
    }
  }

  beforeEach(async () => {
    vi.stubEnv('SCHEDULER_ENABLED', 'true')
    await db.delete(organizations)
    await db.delete(users)
    owner = await newUser('owner')
    recipient = await newUser('recipient')
    orgId = (await organizationService.create({ userId: owner }, { name: 'Guards' })).id
    recipientMemberId = (
      await memberService.add({ userId: owner }, { organizationId: orgId, userId: recipient })
    ).id
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('the previous owner with a stale tenant cannot act as owner after the accept', async () => {
    const { token } = await ownershipTransferService.start({ userId: owner }, orgId, {
      recipientMemberId,
    })
    await ownershipTransferService.accept({ userId: recipient }, token)
    // вызовы сервиса напрямую — как запрос, прошедший requireOrgOwner до принятия
    const attempts = [
      () => organizationDeletionService.delete({ userId: owner }, orgId, { confirmName: 'Guards' }),
      () => ownershipTransferService.start({ userId: owner }, orgId, { recipientMemberId }),
      () => ownershipTransferService.cancel({ userId: owner }, orgId),
      () => organizationDeletionService.restore({ userId: owner }, orgId),
    ]
    for (const attempt of attempts)
      await expect(attempt()).rejects.toMatchObject({ code: 'forbidden.owner_only' })
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
    expect(org).toMatchObject({ ownerUserId: recipient, deletedAt: null })
  })

  it('an archived group does not accept a pending transfer', async () => {
    const { token } = await ownershipTransferService.start({ userId: owner }, orgId, {
      recipientMemberId,
    })
    await db.update(organizations).set({ status: 'archived' }).where(eq(organizations.id, orgId))
    await expect(
      ownershipTransferService.accept({ userId: recipient }, token),
    ).rejects.toMatchObject({ code: 'ownership_transfer.invalid' })
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
    expect(org!.ownerUserId).toBe(owner)
  })

  it('auto-close that selected the event before the deletion committed skips it under lock', async () => {
    const startsAt = new Date(Date.now() + 48 * 3600_000)
    const ev = await eventService.create({ userId: owner }, orgId, {
      title: 'Close',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 7200_000),
      capacity: 4,
      price: 1000,
    })
    const now = new Date(startsAt.getTime() - 119 * 60_000)
    const inFlight = await deletionInFlight()
    // выборка видит группу живой (удаление не закоммичено), транзакция события ждёт строку группы
    const closing = closeDueEvents(now)
    await waiters(2)
    await inFlight.finish()
    expect(await closing).toMatchObject({ closed: 0 })
    const [after] = await db.select().from(events).where(eq(events.id, ev.id))
    expect(after!.status).toBe('published')
  })

  it('the offer sweep that selected the event before the deletion committed offers nothing', async () => {
    const startsAt = new Date(Date.now() + 48 * 3600_000)
    const ev = await eventService.create({ userId: owner }, orgId, {
      title: 'Sweep',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 7200_000),
      capacity: 1,
      price: 0,
    })
    const other = await newUser('queue')
    await memberService.add({ userId: owner }, { organizationId: orgId, userId: other })
    await bookingService.book({ userId: recipient }, orgId, ev.id, { method: 'free' })
    const queued = await bookingService.book({ userId: other }, orgId, ev.id, { method: 'free' })
    expect(queued.status).toBe('waitlisted')
    // место освободилось без триггера: его подберёт только проход по очереди
    await db.update(events).set({ capacity: 2 }).where(eq(events.id, ev.id))
    const inFlight = await deletionInFlight()
    const sweep = offerFreeSeatsSweep(new Date())
    await waiters(2)
    await inFlight.finish()
    expect(await sweep).toBe(0)
    expect(await db.select().from(waitlistOffers).where(eq(waitlistOffers.eventId, ev.id))).toEqual(
      [],
    )
  })
})
