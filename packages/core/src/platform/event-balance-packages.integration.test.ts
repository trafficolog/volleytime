import {
  auditLog,
  closeDb,
  db,
  eq,
  eventBalancePackages,
  eventBalancePurchaseRequests,
  organizations,
  sql,
  users,
} from '@volley-time/db'
import { resetEventBalancePackages } from '@volley-time/db/test-utils'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { eventBalanceService } from '../event-balance/service'
import { ForbiddenError } from '../permissions/errors'

import { platformEventBalancePackagesService as service } from './event-balance-packages'

/**
 * Task 22.2.1 (ADR-22-2-1): каталог пакетов баланса событий в Root Admin. Часы не участвуют:
 * даты в проверках берутся из ответов сервиса.
 */
describe('platformEventBalancePackagesService (integration)', { timeout: 60_000 }, () => {
  let seq = 0
  let rootId: number
  let plainId: number
  let orgId: number
  const ctx = () => ({ userId: rootId })

  const newUser = async (label: string, isRootAdmin = false) =>
    (
      await db
        .insert(users)
        .values({ email: `pkg-${label}-${++seq}@t.by`, name: label, isRootAdmin })
        .returning()
    )[0]!.id

  const auditOf = async (action?: string) => {
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityType, 'event_balance_package'))
    return rows.filter((r) => !action || r.action === action).sort((a, b) => a.id - b.id)
  }

  const requestRow = async (
    snapshot: { units: number; amount: number },
    status: 'pending' | 'approved' | 'rejected' | 'cancelled',
    packageId: number | null = null,
  ) => {
    const decided = status !== 'pending'
    const [row] = await db
      .insert(eventBalancePurchaseRequests)
      .values({
        organizationId: orgId,
        requestedByUserId: plainId,
        ...snapshot,
        currency: 'BYN',
        status,
        packageId,
        decidedByUserId: decided ? rootId : null,
        decidedAt: decided ? new Date() : null,
      })
      .returning()
    return row!
  }

  const byCode = async (code: string) =>
    (await service.list(ctx(), { archived: false })).packages.find((p) => p.code === code)!

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await resetEventBalancePackages()
    rootId = await newUser('root', true)
    plainId = await newUser('plain')
    orgId = (
      await db
        .insert(organizations)
        .values({ name: 'Pkg Org', slug: `pkg-org-${++seq}`, ownerUserId: plainId })
        .returning()
    )[0]!.id
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await resetEventBalancePackages()
    await closeDb()
  })

  describe('access', () => {
    it('refuses every operation for a non-root user and does not touch the catalog', async () => {
      const plain = { userId: plainId }
      const [p] = (await service.list(ctx(), { archived: false })).packages
      const calls = [
        () => service.list(plain, { archived: false }),
        () => service.create(plain, { units: 5, amount: 1 }),
        () => service.duplicate(plain, p!.id, { units: 7 }),
        () => service.update(plain, p!.id, { version: p!.version, amount: 1 }),
        () => service.archive(plain, p!.id, { version: p!.version }),
        () => service.history(plain, {}),
      ]
      for (const call of calls) {
        await expect(call()).rejects.toBeInstanceOf(ForbiddenError)
        await expect(call()).rejects.toMatchObject({ code: 'forbidden.root_only' })
      }
      expect(await db.select().from(eventBalancePackages)).toHaveLength(3)
      expect(await auditOf()).toHaveLength(0)
    })
  })

  describe('list', () => {
    it('returns the seeded catalog with price per event and empty sales', async () => {
      const { packages, unattributed } = await service.list(ctx(), { archived: false })
      expect(
        packages.map((p) => [p.code, p.units, p.amount, p.pricePerEvent, p.badge, p.visible]),
      ).toEqual([
        ['events_10', 10, 5000, 500, null, true],
        ['events_30', 30, 12000, 400, 'popular', true],
        ['events_100', 100, 35000, 350, null, true],
      ])
      expect(packages.every((p) => p.sales.length === 0 && p.version === 1)).toBe(true)
      expect(unattributed).toEqual([])
    })

    it('rounds the price per event half-up to a whole minor unit', async () => {
      const a = await service.create(ctx(), { units: 3, amount: 100 }) // 33.33 -> 33
      const b = await service.create(ctx(), { units: 8, amount: 5 }) // 0.625 -> 1
      const c = await service.create(ctx(), { units: 4, amount: 6 }) // 1.5 -> 2
      const d = await service.create(ctx(), { units: 6, amount: 0 })
      expect([a, b, c, d].map((p) => p.pricePerEvent)).toEqual([33, 1, 2, 0])
    })

    it('splits active and archived packages and orders by sort order, units, id', async () => {
      const draft = await service.create(ctx(), { units: 5, amount: 1000, sortOrder: 5 })
      const tie = await service.create(ctx(), { units: 4, amount: 900, sortOrder: 5 })
      const old = await service.create(ctx(), { units: 7, amount: 1 })
      await service.archive(ctx(), old.id, { version: old.version })
      const active = await service.list(ctx(), { archived: false })
      expect(active.packages.map((p) => p.code)).toEqual([
        'events_4',
        'events_5',
        'events_10',
        'events_30',
        'events_100',
      ])
      expect(active.packages.find((p) => p.id === draft.id)?.visible).toBe(false)
      expect(tie.units).toBe(4)
      const archived = await service.list(ctx(), { archived: true })
      expect(archived.packages.map((p) => p.code)).toEqual(['events_7'])
      expect(archived.packages[0]!.archivedAt).not.toBeNull()
    })
  })

  describe('create', () => {
    it('creates a hidden draft with a server-generated code, version 1 and an audit record', async () => {
      const created = await service.create(ctx(), { units: 50, amount: 17000 })
      expect(created).toMatchObject({
        code: 'events_50',
        units: 50,
        amount: 17000,
        currency: 'BYN',
        badge: null,
        visible: false,
        archivedAt: null,
        sortOrder: 0,
        version: 1,
        pricePerEvent: 340,
        sales: [],
      })
      const [entry] = await auditOf('event_balance_package.created')
      expect(entry).toMatchObject({
        organizationId: null,
        userId: rootId,
        entityType: 'event_balance_package',
        entityId: created.id,
      })
      expect(entry!.newValue).toMatchObject({ units: 50, amount: 17000, visible: false })
    })

    it('never shows a draft to organizers', async () => {
      await service.create(ctx(), { units: 50, amount: 17000 })
      const view = await eventBalanceService.get({ userId: plainId }, orgId)
      expect(view.packages.map((p) => p.code)).toEqual(['events_10', 'events_30', 'events_100'])
    })

    it('generates the first free code, never reusing the code of an archived package', async () => {
      const first = await service.create(ctx(), { units: 5, amount: 100 })
      await service.archive(ctx(), first.id, { version: first.version })
      const second = await service.create(ctx(), { units: 5, amount: 200 })
      await service.archive(ctx(), second.id, { version: second.version })
      const third = await service.create(ctx(), { units: 5, amount: 300 })
      expect([first.code, second.code, third.code]).toEqual([
        'events_5',
        'events_5_2',
        'events_5_3',
      ])
    })

    it('rejects a second non-archived package with the same units and currency (409), drafts included', async () => {
      await expect(service.create(ctx(), { units: 10, amount: 1 })).rejects.toMatchObject({
        code: 'event_balance_package.units_taken',
      })
      await service.create(ctx(), { units: 5, amount: 1 }) // черновик
      await expect(service.create(ctx(), { units: 5, amount: 2 })).rejects.toMatchObject({
        code: 'event_balance_package.units_taken',
      })
      expect(await auditOf('event_balance_package.created')).toHaveLength(1)
    })

    it('rolls the change back when the audit record fails (same transaction)', async () => {
      await db.execute(sql`
        CREATE FUNCTION pkg_audit_fail() RETURNS trigger LANGUAGE plpgsql AS
        $$ BEGIN RAISE EXCEPTION 'audit refused'; END $$`)
      await db.execute(sql`
        CREATE TRIGGER pkg_audit_fail BEFORE INSERT ON audit_log
        FOR EACH ROW WHEN (NEW.entity_type = 'event_balance_package')
        EXECUTE FUNCTION pkg_audit_fail()`)
      try {
        const src = await byCode('events_10')
        await expect(service.create(ctx(), { units: 5, amount: 1 })).rejects.toBeDefined()
        await expect(service.update(ctx(), src.id, { version: 1, amount: 1 })).rejects.toBeDefined()
        await expect(service.archive(ctx(), src.id, { version: 1 })).rejects.toBeDefined()
      } finally {
        await db.execute(sql`DROP TRIGGER pkg_audit_fail ON audit_log`)
        await db.execute(sql`DROP FUNCTION pkg_audit_fail()`)
      }
      expect(await db.select().from(eventBalancePackages)).toHaveLength(3)
      expect(await byCode('events_10')).toMatchObject({
        amount: 5000,
        version: 1,
        archivedAt: null,
      })
    })

    it('validates the payload strictly (units, amount, currency, badge, extra fields)', async () => {
      const bad: Record<string, unknown>[] = [
        { units: 0, amount: 1 },
        { units: 10_001, amount: 1 },
        { units: 1.5, amount: 1 },
        { units: 5, amount: -1 },
        { units: 5, amount: 10_000_001 },
        { units: 5, amount: 1, currency: 'USD' },
        { units: 5, amount: 1, badge: 'hot' },
        { units: 5, amount: 1, sortOrder: 10_001 },
        { units: 5, amount: 1, code: 'events_5' },
        { amount: 1 },
      ]
      for (const body of bad) {
        await expect(
          service.create(ctx(), body as never),
          JSON.stringify(body),
        ).rejects.toMatchObject({ name: 'ZodError' })
      }
      await service.create(ctx(), { units: 10_000, amount: 10_000_000 }) // границы допустимы
      await service.create(ctx(), { units: 1, amount: 0, badge: 'best_price' })
    })

    it('serializes concurrent creation: one wins, the other gets units_taken, never a 500', async () => {
      const results = await Promise.allSettled([
        service.create(ctx(), { units: 25, amount: 1 }),
        service.create(ctx(), { units: 25, amount: 2 }),
        service.create(ctx(), { units: 25, amount: 3 }),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      for (const r of results) {
        if (r.status === 'rejected') {
          expect(r.reason).toMatchObject({ code: 'event_balance_package.units_taken' })
        }
      }
    })

    it('generates distinct codes under concurrent creation of different units', async () => {
      const made = await Promise.all(
        [11, 12, 13, 14].map((u) => service.create(ctx(), { units: u, amount: u })),
      )
      expect(made.map((p) => p.code).sort()).toEqual([
        'events_11',
        'events_12',
        'events_13',
        'events_14',
      ])
    })
  })

  describe('duplicate', () => {
    it('creates a new draft copying the badge, with sort order +1 and the new units and price', async () => {
      const src = await byCode('events_30')
      const copy = await service.duplicate(ctx(), src.id, { units: 60, amount: 21000 })
      expect(copy).toMatchObject({
        code: 'events_60',
        units: 60,
        amount: 21000,
        badge: 'popular',
        visible: false,
        archivedAt: null,
        sortOrder: src.sortOrder + 1,
        version: 1,
      })
      const [entry] = await auditOf('event_balance_package.created')
      expect(entry!.newValue).toMatchObject({ duplicatedFromId: src.id, units: 60 })
      // источник не тронут
      expect(await byCode('events_30')).toMatchObject({ version: 1, amount: 12000 })
    })

    it('takes the price from the source when only units are given', async () => {
      const src = await byCode('events_10')
      const copy = await service.duplicate(ctx(), src.id, { units: 20 })
      expect(copy).toMatchObject({ units: 20, amount: 5000 })
    })

    it('answers units_taken without units or with a taken quantity', async () => {
      const src = await byCode('events_10')
      await expect(service.duplicate(ctx(), src.id, {})).rejects.toMatchObject({
        code: 'event_balance_package.units_taken',
      })
      await expect(service.duplicate(ctx(), src.id, { units: 30 })).rejects.toMatchObject({
        code: 'event_balance_package.units_taken',
      })
    })

    it('allows duplicating an archived package with the same units when no active one holds them', async () => {
      const made = await service.create(ctx(), { units: 15, amount: 7000 })
      await service.archive(ctx(), made.id, { version: made.version })
      const copy = await service.duplicate(ctx(), made.id, {})
      expect(copy).toMatchObject({ units: 15, amount: 7000, visible: false })
      expect(copy.code).toBe('events_15_2')
      await expect(service.duplicate(ctx(), made.id, {})).rejects.toMatchObject({
        code: 'event_balance_package.units_taken',
      })
    })

    it('is 404 for an unknown package and 422 for a bad body', async () => {
      await expect(service.duplicate(ctx(), 999_999, { units: 7 })).rejects.toMatchObject({
        code: 'event_balance_package.not_found',
      })
      const src = await byCode('events_10')
      await expect(service.duplicate(ctx(), src.id, { units: 0 } as never)).rejects.toMatchObject({
        name: 'ZodError',
      })
      await expect(service.duplicate(ctx(), src.id, { code: 'x' } as never)).rejects.toMatchObject({
        name: 'ZodError',
      })
    })
  })

  describe('update', () => {
    it('changes price, badge and sort order, bumps the version, audits only the changed fields', async () => {
      const src = await byCode('events_10')
      const updated = await service.update(ctx(), src.id, {
        version: src.version,
        amount: 5500,
        badge: 'discount',
      })
      expect(updated).toMatchObject({
        amount: 5500,
        badge: 'discount',
        version: 2,
        pricePerEvent: 550,
      })
      expect(updated.updatedAt >= src.updatedAt).toBe(true)
      const [entry] = await auditOf('event_balance_package.updated')
      expect(entry).toMatchObject({ entityId: src.id, userId: rootId, organizationId: null })
      expect(entry!.oldValue).toEqual({ amount: 5000, badge: null })
      expect(entry!.newValue).toEqual({ amount: 5500, badge: 'discount' })
      expect(await auditOf('event_balance_package.visibility_changed')).toHaveLength(0)
    })

    it('records visibility changes as their own audit action, and both when both change', async () => {
      const src = await byCode('events_10')
      const hidden = await service.update(ctx(), src.id, { version: 1, visible: false })
      expect(hidden).toMatchObject({ visible: false, version: 2 })
      const both = await service.update(ctx(), src.id, { version: 2, visible: true, sortOrder: 99 })
      expect(both).toMatchObject({ visible: true, sortOrder: 99, version: 3 })
      const vis = await auditOf('event_balance_package.visibility_changed')
      expect(vis.map((e) => [e.oldValue, e.newValue])).toEqual([
        [{ visible: true }, { visible: false }],
        [{ visible: false }, { visible: true }],
      ])
      const upd = await auditOf('event_balance_package.updated')
      expect(upd).toHaveLength(1)
      expect(upd[0]!.newValue).toEqual({ sortOrder: 99 })
    })

    it('treats a no-op as no change: no version bump and no audit', async () => {
      const src = await byCode('events_10')
      const same = await service.update(ctx(), src.id, { version: 1, amount: 5000, badge: null })
      expect(same.version).toBe(1)
      expect(await auditOf()).toHaveLength(0)
    })

    it('rejects a stale version with 409 and leaves the package untouched', async () => {
      const src = await byCode('events_10')
      await service.update(ctx(), src.id, { version: 1, amount: 5100 })
      await expect(
        service.update(ctx(), src.id, { version: 1, amount: 5200 }),
      ).rejects.toMatchObject({ code: 'event_balance_package.stale' })
      expect(await byCode('events_10')).toMatchObject({ amount: 5100, version: 2 })
      expect(await auditOf('event_balance_package.updated')).toHaveLength(1)
    })

    it('lets exactly one of two concurrent edits with the same version win', async () => {
      const src = await byCode('events_100')
      const results = await Promise.allSettled([
        service.update(ctx(), src.id, { version: 1, amount: 30000 }),
        service.update(ctx(), src.id, { version: 1, amount: 31000 }),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
      expect(lost.reason).toMatchObject({ code: 'event_balance_package.stale' })
      expect((await byCode('events_100')).version).toBe(2)
    })

    it('refuses units, currency and code in the body (422) and unknown ids (404)', async () => {
      const src = await byCode('events_10')
      for (const extra of [{ units: 11 }, { currency: 'USD' }, { code: 'events_11' }]) {
        await expect(
          service.update(ctx(), src.id, { version: 1, ...extra } as never),
        ).rejects.toMatchObject({ name: 'ZodError' })
      }
      await expect(service.update(ctx(), src.id, { amount: 1 } as never)).rejects.toMatchObject({
        name: 'ZodError',
      })
      await expect(service.update(ctx(), 999_999, { version: 1, amount: 1 })).rejects.toMatchObject(
        {
          code: 'event_balance_package.not_found',
        },
      )
      expect(await byCode('events_10')).toMatchObject({ units: 10, version: 1 })
    })

    it('refuses to edit an archived package (409)', async () => {
      const made = await service.create(ctx(), { units: 9, amount: 9 })
      const archived = await service.archive(ctx(), made.id, { version: 1 })
      await expect(
        service.update(ctx(), made.id, { version: archived.version, amount: 5 }),
      ).rejects.toMatchObject({ code: 'event_balance_package.archived' })
    })

    it('publishing a draft makes it visible to organizers and hiding removes it', async () => {
      const made = await service.create(ctx(), { units: 20, amount: 8000, badge: 'best_price' })
      await service.update(ctx(), made.id, { version: 1, visible: true })
      let view = await eventBalanceService.get({ userId: plainId }, orgId)
      expect(view.packages.map((p) => p.code)).toContain('events_20')
      expect(view.packages.find((p) => p.code === 'events_20')).toMatchObject({
        badge: 'best_price',
        popular: false,
      })
      await service.update(ctx(), made.id, { version: 2, visible: false })
      view = await eventBalanceService.get({ userId: plainId }, orgId)
      expect(view.packages.map((p) => p.code)).not.toContain('events_20')
    })
  })

  describe('archive', () => {
    it('archives, hides, bumps the version and audits once; a repeat is a 200 without a new record', async () => {
      const src = await byCode('events_100')
      const archived = await service.archive(ctx(), src.id, { version: src.version })
      expect(archived.archivedAt).not.toBeNull()
      expect(archived).toMatchObject({ visible: false, version: 2 })
      const again = await service.archive(ctx(), src.id, { version: 1 }) // даже со старым version
      expect(again).toMatchObject({ version: 2, archivedAt: archived.archivedAt })
      expect(await auditOf('event_balance_package.archived')).toHaveLength(1)
      const view = await eventBalanceService.get({ userId: plainId }, orgId)
      expect(view.packages.map((p) => p.code)).toEqual(['events_10', 'events_30'])
    })

    it('rejects a stale version and an unknown id', async () => {
      const src = await byCode('events_100')
      await service.update(ctx(), src.id, { version: 1, amount: 34000 })
      await expect(service.archive(ctx(), src.id, { version: 1 })).rejects.toMatchObject({
        code: 'event_balance_package.stale',
      })
      await expect(service.archive(ctx(), 999_999, { version: 1 })).rejects.toMatchObject({
        code: 'event_balance_package.not_found',
      })
      expect((await byCode('events_100')).archivedAt).toBeNull()
    })

    it('does not cancel or change a pending request of the archived package', async () => {
      const request = await eventBalanceService.createPurchaseRequest({ userId: plainId }, orgId, {
        packageCode: 'events_30',
      })
      const src = await byCode('events_30')
      await service.archive(ctx(), src.id, { version: src.version })
      const [after] = await db
        .select()
        .from(eventBalancePurchaseRequests)
        .where(eq(eventBalancePurchaseRequests.id, request.id))
      expect(after).toMatchObject({
        status: 'pending',
        units: 30,
        amount: 12000,
        packageId: src.id,
      })
      await expect(
        eventBalanceService.createPurchaseRequest({ userId: plainId }, orgId, {
          packageCode: 'events_30',
        }),
      ).rejects.toMatchObject({ code: 'event_balance.package_unavailable' })
    })
  })

  describe('purchase concurrency (FOR SHARE / FOR UPDATE)', () => {
    it('a request racing a price change sees either the old or the new version whole', async () => {
      const src = await byCode('events_10')
      const [request, edit] = await Promise.all([
        eventBalanceService.createPurchaseRequest({ userId: plainId }, orgId, {
          packageCode: 'events_10',
        }),
        service.update(ctx(), src.id, { version: 1, amount: 9000 }),
      ])
      expect(edit.amount).toBe(9000)
      expect([5000, 9000]).toContain(request.amount)
      expect(request.units).toBe(10)
    })

    it('a request racing an archive either gets the package or is refused, never a half state', async () => {
      const src = await byCode('events_10')
      const [request, archive] = await Promise.allSettled([
        eventBalanceService.createPurchaseRequest({ userId: plainId }, orgId, {
          packageCode: 'events_10',
        }),
        service.archive(ctx(), src.id, { version: 1 }),
      ])
      expect(archive.status).toBe('fulfilled')
      if (request.status === 'rejected') {
        expect(request.reason).toMatchObject({ code: 'event_balance.package_unavailable' })
      } else {
        expect(request.value).toMatchObject({ units: 10, amount: 5000, packageId: src.id })
      }
    })
  })

  describe('sales and revenue', () => {
    it('counts only approved requests, per currency snapshot, never recomputing by the current price', async () => {
      const p10 = await byCode('events_10')
      await requestRow({ units: 10, amount: 5000 }, 'approved', p10.id)
      await requestRow({ units: 10, amount: 5000 }, 'approved', p10.id)
      await requestRow({ units: 10, amount: 5000 }, 'pending', p10.id)
      await requestRow({ units: 10, amount: 5000 }, 'rejected', p10.id)
      await requestRow({ units: 10, amount: 5000 }, 'cancelled', p10.id)
      // цена сменилась: выручка по заявкам с package_id остаётся по снимку
      await service.update(ctx(), p10.id, { version: 1, amount: 6000 })
      await requestRow({ units: 10, amount: 6000 }, 'approved', p10.id)
      const after = await byCode('events_10')
      expect(after.sales).toEqual([{ currency: 'BYN', sold: 3, revenue: 5000 * 2 + 6000 }])
    })

    it('attributes legacy requests (no package_id) by the current row and leaves the rest unattributed', async () => {
      await requestRow({ units: 30, amount: 12000 }, 'approved') // совпадает с events_30
      await requestRow({ units: 30, amount: 11000 }, 'approved') // нет совпадения
      await requestRow({ units: 30, amount: 12000 }, 'pending') // не считается
      const { packages, unattributed } = await service.list(ctx(), { archived: false })
      expect(packages.find((p) => p.code === 'events_30')!.sales).toEqual([
        { currency: 'BYN', sold: 1, revenue: 12000 },
      ])
      expect(unattributed).toEqual([{ currency: 'BYN', sold: 1, revenue: 11000 }])
    })

    it('moves legacy requests to unattributed after a price change, not to the new price', async () => {
      await requestRow({ units: 100, amount: 35000 }, 'approved')
      const src = await byCode('events_100')
      expect(src.sales).toEqual([{ currency: 'BYN', sold: 1, revenue: 35000 }])
      await service.update(ctx(), src.id, { version: 1, amount: 33000 })
      const { packages, unattributed } = await service.list(ctx(), { archived: false })
      expect(packages.find((p) => p.code === 'events_100')!.sales).toEqual([])
      expect(unattributed).toEqual([{ currency: 'BYN', sold: 1, revenue: 35000 }])
    })

    it('never counts a request twice: per-package sales plus unattributed equal all approved requests', async () => {
      const p10 = await byCode('events_10')
      await requestRow({ units: 10, amount: 5000 }, 'approved', p10.id)
      await requestRow({ units: 10, amount: 5000 }, 'approved') // legacy, тот же снимок
      await requestRow({ units: 30, amount: 12000 }, 'approved')
      await requestRow({ units: 7, amount: 700 }, 'approved')
      const { packages, unattributed } = await service.list(ctx(), { archived: false })
      const total = [...packages.flatMap((p) => p.sales), ...unattributed].reduce(
        (acc, s) => ({ sold: acc.sold + s.sold, revenue: acc.revenue + s.revenue }),
        { sold: 0, revenue: 0 },
      )
      expect(total).toEqual({ sold: 4, revenue: 5000 + 5000 + 12000 + 700 })
    })

    it('prefers the non-archived package among legacy candidates and the lowest id otherwise', async () => {
      const old = await service.create(ctx(), { units: 40, amount: 15000 })
      await service.archive(ctx(), old.id, { version: 1 })
      const fresh = await service.create(ctx(), { units: 40, amount: 15000 })
      await requestRow({ units: 40, amount: 15000 }, 'approved')
      const active = await service.list(ctx(), { archived: false })
      const archived = await service.list(ctx(), { archived: true })
      expect(active.packages.find((p) => p.id === fresh.id)!.sales).toHaveLength(1)
      expect(archived.packages.find((p) => p.id === old.id)!.sales).toEqual([])
    })

    it('keeps currencies apart', async () => {
      const p10 = await byCode('events_10')
      await requestRow({ units: 10, amount: 5000 }, 'approved', p10.id)
      await db.insert(eventBalancePurchaseRequests).values({
        organizationId: orgId,
        requestedByUserId: plainId,
        units: 10,
        amount: 100,
        currency: 'USD',
        status: 'approved',
        packageId: p10.id,
        decidedByUserId: rootId,
        decidedAt: new Date(),
      })
      const sales = (await byCode('events_10')).sales
      expect(sales.sort((a, b) => a.currency.localeCompare(b.currency))).toEqual([
        { currency: 'BYN', sold: 1, revenue: 5000 },
        { currency: 'USD', sold: 1, revenue: 100 },
      ])
    })
  })

  describe('history', () => {
    it('lists package audit records newest first with actor and package code, and paginates by id', async () => {
      const made = await service.create(ctx(), { units: 6, amount: 600 })
      await service.update(ctx(), made.id, { version: 1, amount: 700 })
      await service.update(ctx(), made.id, { version: 2, visible: true })
      await service.archive(ctx(), made.id, { version: 3 })
      // посторонняя запись аудита не попадает в историю
      await db.insert(auditLog).values({
        action: 'organization.created',
        entityType: 'organization',
        entityId: 1,
      })
      const page1 = await service.history(ctx(), { limit: 3 })
      expect(page1.entries.map((e) => e.action)).toEqual([
        'event_balance_package.archived',
        'event_balance_package.visibility_changed',
        'event_balance_package.updated',
      ])
      expect(page1.entries[0]).toMatchObject({
        packageId: made.id,
        packageCode: 'events_6',
        actor: { id: rootId },
      })
      expect(page1.nextCursor).toBe(page1.entries[2]!.id)
      const page2 = await service.history(ctx(), { limit: 3, cursor: page1.nextCursor! })
      expect(page2.entries.map((e) => e.action)).toEqual(['event_balance_package.created'])
      expect(page2.nextCursor).toBeNull()
    })
  })
})
