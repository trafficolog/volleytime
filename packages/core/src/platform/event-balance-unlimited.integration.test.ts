import {
  appendEventBalanceEntry,
  auditLog,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  events,
  organizationEventBalances,
  organizations,
  users,
} from '@volley-time/db'
import { addIsoDays, minskToday, unlimitedBoundary } from '@volley-time/shared'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { eventBalanceService } from '../event-balance/service'
import { eventService } from '../events/service'
import { organizationService } from '../organizations/service'
import { ForbiddenError } from '../permissions/errors'

import { platformEventBalanceUnlimitedService as service } from './event-balance-unlimited'

/**
 * Task 22.3.1 (ADR-22-3-1): безлимит событий группы до даты по Минску (исключающая граница).
 * Время фиксируется только для `Date`: проверка срока идёт по часам приложения.
 */
describe('event balance unlimited (integration)', { timeout: 60_000 }, () => {
  let seq = 0
  let rootId: number
  let ownerId: number
  let orgId: number
  const ctx = () => ({ userId: rootId })
  const owner = () => ({ userId: ownerId })
  const previousFlag = process.env.EVENT_BALANCE_ENFORCED

  const newUser = async (label: string, isRootAdmin = false) =>
    (
      await db
        .insert(users)
        .values({ email: `unl-${label}-${++seq}@t.by`, name: label, isRootAdmin })
        .returning()
    )[0]!.id

  const auditOf = async () =>
    (
      await db.select().from(auditLog).where(eq(auditLog.entityId, orgId)).orderBy(auditLog.id)
    ).filter((r) => r.action.startsWith('event_balance.unlimited'))

  const balance = async () =>
    (
      await db
        .select()
        .from(organizationEventBalances)
        .where(eq(organizationEventBalances.organizationId, orgId))
    )[0]!.balance

  const spendRows = async () =>
    (
      await db
        .select()
        .from(eventBalanceEntries)
        .where(eq(eventBalanceEntries.organizationId, orgId))
    ).filter((e) => e.reason === 'spend')

  const codeOf = async (p: Promise<unknown>) => {
    try {
      await p
      return 'ok'
    } catch (e) {
      const err = e as { code?: string; name?: string }
      return err.code ?? err.name
    }
  }

  beforeEach(async () => {
    process.env.EVENT_BALANCE_ENFORCED = 'true'
    await db.delete(organizations)
    await db.delete(users)
    rootId = await newUser('root', true)
    ownerId = await newUser('owner')
    orgId = (await organizationService.create(owner(), { name: 'Unlimited' })).id
  })

  afterEach(() => {
    vi.useRealTimers()
    if (previousFlag === undefined) delete process.env.EVENT_BALANCE_ENFORCED
    else process.env.EVENT_BALANCE_ENFORCED = previousFlag
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  const input = (days = 5) => ({
    until: addIsoDays(minskToday(), days),
    reason: 'Пилотная группа',
  })

  describe('API contract', () => {
    it('is root-only', async () => {
      const err = await service.set(owner(), orgId, input()).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(ForbiddenError)
      expect((err as ForbiddenError).code).toBe('forbidden.root_only')
      expect(await codeOf(service.cancel(owner(), orgId, { reason: 'нет причины' }))).toBe(
        'forbidden.root_only',
      )
    })

    it('stores the exclusive Minsk boundary and audits set; the same date again is a no-op', async () => {
      const body = input(3)
      expect(await service.set(ctx(), orgId, body)).toEqual({ until: body.until, active: true })
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
      expect(org!.eventBalanceUnlimitedUntil).toEqual(unlimitedBoundary(body.until))
      expect(org!.eventBalanceUnlimitedUntil!.toISOString().slice(11)).toBe('21:00:00.000Z')
      const log = await auditOf()
      expect(log).toHaveLength(1)
      expect(log[0]).toMatchObject({
        action: 'event_balance.unlimited_set',
        entityType: 'organization',
        organizationId: orgId,
        userId: rootId,
        oldValue: null,
        newValue: { until: body.until, reason: 'Пилотная группа' },
      })
      await service.set(ctx(), orgId, { ...body, reason: 'Другая причина' })
      expect(await auditOf()).toHaveLength(1)
    })

    it('changing the date audits unlimited_changed with the previous date', async () => {
      const first = input(3)
      const second = input(10)
      await service.set(ctx(), orgId, first)
      await service.set(ctx(), orgId, second)
      const log = await auditOf()
      expect(log.map((r) => r.action)).toEqual([
        'event_balance.unlimited_set',
        'event_balance.unlimited_changed',
      ])
      expect(log[1]).toMatchObject({
        oldValue: { until: first.until },
        newValue: { until: second.until, reason: 'Пилотная группа' },
      })
    })

    it('accepts today and today + 366 days, refuses yesterday, +367 days and invalid input', async () => {
      const today = minskToday()
      expect((await service.set(ctx(), orgId, { until: today, reason: 'сегодня' })).active).toBe(
        true,
      )
      expect(
        (await service.set(ctx(), orgId, { until: addIsoDays(today, 366), reason: 'год' })).active,
      ).toBe(true)
      for (const bad of [
        { until: addIsoDays(today, -1), reason: 'вчера' },
        { until: addIsoDays(today, 367), reason: 'далеко' },
        { until: '2026-02-30', reason: 'нет такой даты' },
        { until: '31.12.2026', reason: 'формат' },
        { until: today, reason: 'ab' },
        { until: today, reason: 'x'.repeat(501) },
        { until: today, reason: 'причина\nс переводом' },
        { until: today, reason: 'ok', extra: 1 },
        { reason: 'без даты' },
      ]) {
        expect(await codeOf(service.set(ctx(), orgId, bad)), JSON.stringify(bad)).toBe('ZodError')
      }
    })

    it('404 for a missing group and 409 organization.deleted for a soft-deleted one', async () => {
      expect(await codeOf(service.set(ctx(), 999_999, input()))).toBe('organization.not_found')
      await db
        .update(organizations)
        .set({ deletedAt: new Date(), restoreUntil: new Date(Date.now() + 86_400_000) })
        .where(eq(organizations.id, orgId))
      expect(await codeOf(service.set(ctx(), orgId, input()))).toBe('organization.deleted')
      expect(await codeOf(service.cancel(ctx(), orgId, { reason: 'снять' }))).toBe(
        'organization.deleted',
      )
    })

    it('cancel clears the date and audits with the reason; cancelling again is a no-op', async () => {
      const body = input(4)
      await service.set(ctx(), orgId, body)
      expect(await service.cancel(ctx(), orgId, { reason: 'Пилот закончен' })).toEqual({
        until: null,
        active: false,
      })
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
      expect(org!.eventBalanceUnlimitedUntil).toBeNull()
      const log = await auditOf()
      expect(log.at(-1)).toMatchObject({
        action: 'event_balance.unlimited_cancelled',
        oldValue: { until: body.until },
        newValue: { until: null, reason: 'Пилот закончен' },
      })
      await service.cancel(ctx(), orgId, { reason: 'ещё раз' })
      expect(await auditOf()).toHaveLength(2)
    })

    it('cancel of an expired date clears it without an audit record', async () => {
      await db
        .update(organizations)
        .set({ eventBalanceUnlimitedUntil: new Date(Date.now() - 86_400_000) })
        .where(eq(organizations.id, orgId))
      await service.cancel(ctx(), orgId, { reason: 'почистить' })
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId))
      expect(org!.eventBalanceUnlimitedUntil).toBeNull()
      expect(await auditOf()).toHaveLength(0)
    })
  })

  describe('publication at the Minsk boundary', () => {
    const publish = async (title: string, startsAt: Date) =>
      eventService.create(owner(), orgId, {
        title,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 3600_000),
        capacity: 10,
        price: 0,
      })

    it('the last day is free until 23:59 Minsk, the next day charges', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2030-06-10T12:00:00Z'))
      await service.set(ctx(), orgId, { until: '2030-06-11', reason: 'граница' })
      const startsAt = new Date('2030-07-01T10:00:00Z')

      vi.setSystemTime(new Date('2030-06-11T20:59:59Z')) // 23:59:59 по Минску
      const free = await publish('Последний день', startsAt)
      expect(await balance()).toBe(5)
      expect(await spendRows()).toHaveLength(0)

      vi.setSystemTime(new Date('2030-06-11T21:00:00Z')) // 00:00 следующего дня по Минску
      const charged = await publish('Следующий день', startsAt)
      expect(await balance()).toBe(4)
      expect((await spendRows()).map((r) => r.eventId)).toEqual([charged.id])

      // отмена события из безлимита баланс не возвращает; обычное событие — возвращает
      await eventService.cancel(owner(), free.id)
      expect(await balance()).toBe(4)
      await eventService.cancel(owner(), charged.id)
      expect(await balance()).toBe(5)
    })

    it('no ledger rows and no low-balance notice while unlimited; balance is kept for later', async () => {
      await db.transaction((tx) =>
        appendEventBalanceEntry(tx, {
          organizationId: orgId,
          delta: 6,
          reason: 'correction',
          actor: { kind: 'user', userId: rootId },
          comment: 'setup',
        }),
      )
      await service.set(ctx(), orgId, input(2))
      for (let i = 0; i < 3; i++)
        await publish(`Безлимит ${i}`, new Date(Date.now() + (24 + i) * 3600_000))
      expect(await balance()).toBe(11)
      expect(await spendRows()).toHaveLength(0)
    })

    it('a draft created during unlimited charges when published after it ended; so does a re-publish', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2030-06-10T12:00:00Z'))
      await service.set(ctx(), orgId, { until: '2030-06-11', reason: 'граница' })
      const startsAt = new Date('2030-07-01T10:00:00Z')
      const draft = await eventService.create(owner(), orgId, {
        title: 'Черновик',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 3600_000),
        capacity: 10,
        price: 0,
        status: 'draft',
      })
      const published = await publish('В безлимит', startsAt)
      await eventService.update(owner(), published.id, { status: 'draft' })

      vi.setSystemTime(new Date('2030-06-12T09:00:00Z'))
      await eventService.update(owner(), draft.id, { status: 'published' })
      expect(await balance()).toBe(4)
      await eventService.update(owner(), published.id, { status: 'published' }) // повторная публикация
      expect(await balance()).toBe(3)
      expect((await spendRows()).map((r) => r.eventId).sort()).toEqual(
        [draft.id, published.id].sort(),
      )
    })

    it('does nothing without EVENT_BALANCE_ENFORCED and does not touch purchases', async () => {
      process.env.EVENT_BALANCE_ENFORCED = 'false'
      await service.set(ctx(), orgId, input())
      await publish('Без списания', new Date(Date.now() + 24 * 3600_000))
      expect(await balance()).toBe(5)
      const view = await eventBalanceService.get(owner(), orgId)
      expect(view.unlimited).toEqual({ until: input().until })
      expect(view.packages.length).toBeGreaterThan(0)
    })

    it('the cabinet view hides the unlimited marker once the date has passed', async () => {
      await db
        .update(organizations)
        .set({ eventBalanceUnlimitedUntil: new Date(Date.now() - 1000) })
        .where(eq(organizations.id, orgId))
      expect((await eventBalanceService.get(owner(), orgId)).unlimited).toBeNull()
    })

    it('does not write balance rows when set or cancelled', async () => {
      const before = await db
        .select()
        .from(eventBalanceEntries)
        .where(eq(eventBalanceEntries.organizationId, orgId))
      await service.set(ctx(), orgId, input())
      await service.cancel(ctx(), orgId, { reason: 'снять безлимит' })
      const after = await db
        .select()
        .from(eventBalanceEntries)
        .where(eq(eventBalanceEntries.organizationId, orgId))
      expect(after).toHaveLength(before.length)
      expect(await db.select().from(events).where(eq(events.organizationId, orgId))).toHaveLength(0)
    })
  })
})
