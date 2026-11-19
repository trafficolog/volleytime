import {
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  events,
  organizationEventBalances,
  organizationMembers,
  organizations,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '../permissions/errors'

import { platformOrganizationsService } from './organizations'

/**
 * Task 22.1.3: организации платформы для root. Часы фиксированы (`now`), окна скользящие, поэтому
 * результат не зависит от даты запуска и часового пояса раннера.
 */
describe('platformOrganizationsService (integration)', { timeout: 60_000 }, () => {
  const now = new Date('2026-11-18T12:00:00.000Z')
  const ago = (days: number, hours = 0) =>
    new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000)
  let seq = 0
  let rootId: number
  let plainId: number

  const newUser = async (
    label: string,
    extra: Partial<typeof users.$inferInsert> = {},
  ): Promise<number> =>
    (
      await db
        .insert(users)
        .values({ email: `org-${label}-${++seq}@t.by`, name: label, ...extra })
        .returning()
    )[0]!.id
  const newOrg = async (
    name: string,
    extra: Partial<typeof organizations.$inferInsert> & { balance?: number } = {},
  ): Promise<number> => {
    const { balance, ...rest } = extra
    const id = (
      await db
        .insert(organizations)
        .values({
          name,
          slug: `org-${name.toLowerCase()}-${++seq}`,
          ownerUserId: plainId,
          createdAt: ago(60),
          ...rest,
        })
        .returning()
    )[0]!.id
    if (balance !== undefined) {
      await db.insert(organizationEventBalances).values({ organizationId: id, balance })
    }
    return id
  }
  const newEvent = async (
    org: number,
    startsAt: Date,
    status: (typeof events.$inferInsert)['status'] = 'published',
  ) =>
    (
      await db
        .insert(events)
        .values({
          organizationId: org,
          createdByUserId: plainId,
          title: 'E',
          startsAt,
          endsAt: new Date(startsAt.getTime() + 7_200_000),
          capacity: 10,
          status,
          createdAt: ago(40),
        })
        .returning()
    )[0]!.id
  const newBooking = async (org: number, eventId: number, createdAt: Date) =>
    db.insert(bookings).values({
      eventId,
      userId: await newUser('b'),
      organizationId: org,
      status: 'confirmed',
      method: 'cash',
      createdAt,
    })
  const member = async (org: number, status: 'active' | 'pending' | 'blocked' = 'active') =>
    db.insert(organizationMembers).values({
      organizationId: org,
      userId: await newUser('m'),
      status,
      role: 'player',
    })

  const list = (params: Parameters<typeof platformOrganizationsService.list>[1] = {}) =>
    platformOrganizationsService.list({ userId: rootId }, params, now)

  async function clean() {
    await db.delete(auditLog)
    await db.delete(eventBalanceEntries)
    await db.delete(organizationEventBalances)
    await db.delete(bookings)
    await db.delete(events)
    await db.delete(organizationMembers)
    await db.delete(organizations)
    await db.delete(users)
  }

  beforeEach(async () => {
    await clean()
    rootId = await newUser('root', { isRootAdmin: true })
    plainId = await newUser('plain', { name: 'Owner One', telegramUsername: 'owner_one' })
  })
  afterAll(async () => {
    await clean()
    await closeDb()
  })

  describe('list', () => {
    it('forbids non-root users, including for create and get', async () => {
      await expect(
        platformOrganizationsService.list({ userId: plainId }, {}, now),
      ).rejects.toBeInstanceOf(ForbiddenError)
      await expect(platformOrganizationsService.get({ userId: plainId }, 1, now)).rejects.toThrow(
        /администратору платформы/,
      )
      await expect(
        platformOrganizationsService.create(
          { userId: plainId },
          { name: 'Nope', owner: 'org-x@t.by' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenError)
      expect(await db.$count(organizations)).toBe(0)
    })

    it('returns balance, members, events of the month and last activity per group', async () => {
      const org = await newOrg('Alpha', { balance: 32, city: 'Минск' })
      await member(org)
      await member(org)
      await member(org, 'pending')
      await member(org, 'blocked')
      const inWindow = await newEvent(org, ago(3))
      await newEvent(org, ago(45)) // старше 30 суток
      await newEvent(org, ago(2), 'draft')
      await newEvent(org, ago(2), 'cancelled')
      await newBooking(org, inWindow, ago(1, 2))

      const page = await list()
      expect(page.items).toHaveLength(1)
      expect(page.items[0]).toMatchObject({
        id: org,
        name: 'Alpha',
        city: 'Минск',
        status: 'active',
        balance: 32,
        lowBalance: false,
        members: 2,
        eventsMonth: 1,
        lastActivityAt: ago(1, 2).toISOString(),
        owner: { id: plainId, name: 'Owner One', telegramUsername: 'owner_one' },
      })
      expect(page.total).toBe(1)
    })

    it('treats a group without a balance row as zero and without activity as created-at', async () => {
      await newOrg('Empty', { createdAt: ago(2) })
      const [row] = (await list()).items
      expect(row).toMatchObject({
        balance: 0,
        lowBalance: true,
        members: 0,
        eventsMonth: 0,
        lastActivityAt: ago(2).toISOString(),
      })
    })

    it('hides archived and soft-deleted groups', async () => {
      await newOrg('Live', { balance: 20 })
      await newOrg('Old', { status: 'archived' })
      await newOrg('Gone', { deletedAt: ago(1), restoreUntil: ago(-29) })
      const page = await list()
      expect(page.items.map((o) => o.name)).toEqual(['Live'])
      expect(page.counts.all).toBe(1)
    })

    it('counts chips over all groups and filters by them', async () => {
      const fresh = await newOrg('Fresh', { balance: 40, createdAt: ago(1) })
      await newOrg('Quiet', { balance: 40, createdAt: ago(20) }) // нет активности 7+ суток
      await newOrg('Poor', { balance: 3, createdAt: ago(1) }) // баланс заканчивается
      await newOrg('Blocked', { balance: 40, status: 'suspended', createdAt: ago(20) })
      const ev = await newEvent(await newOrg('Busy', { balance: 40, createdAt: ago(30) }), ago(2))
      expect(ev).toBeGreaterThan(0)

      const all = await list()
      expect(all.counts).toEqual({ all: 5, active: 3, risk: 2, blocked: 1 })

      expect((await list({ status: 'active' })).items.map((o) => o.name).sort()).toEqual([
        'Busy',
        'Fresh',
        'Poor',
      ])
      expect((await list({ status: 'risk' })).items.map((o) => o.name).sort()).toEqual([
        'Poor',
        'Quiet',
      ])
      const blocked = await list({ status: 'blocked' })
      expect(blocked.items.map((o) => o.name)).toEqual(['Blocked'])
      // счётчики не зависят от фильтра
      expect(blocked.counts).toEqual(all.counts)
      expect(fresh).toBeGreaterThan(0)
    })

    it('narrows by low balance, inactivity and search; sorts by events', async () => {
      const a = await newOrg('Alpha', { balance: 40, createdAt: ago(30) })
      const b = await newOrg('Beta', { balance: 5, createdAt: ago(30) })
      const owner = await newUser('bob', { name: 'Bob Marley', email: 'bob@vt.test' })
      await newOrg('Gamma', { balance: 40, createdAt: ago(30), ownerUserId: owner })
      await newEvent(a, ago(1))
      await newEvent(a, ago(2))
      await newEvent(b, ago(3))

      expect((await list({ lowBalance: true })).items.map((o) => o.name)).toEqual(['Beta'])
      expect((await list({ inactive: true })).items.map((o) => o.name)).toEqual(['Gamma'])
      expect((await list({ q: 'bob@' })).items.map((o) => o.name)).toEqual(['Gamma'])
      expect((await list({ q: ' ALPHA ' })).items.map((o) => o.name)).toEqual(['Alpha'])
      // подстановочные символы LIKE ищутся как текст
      expect((await list({ q: '%' })).items).toHaveLength(0)
      expect((await list({ sort: 'events' })).items.map((o) => o.name)).toEqual([
        'Alpha',
        'Beta',
        'Gamma',
      ])
    })

    it('sorts by recent activity by default and paginates', async () => {
      const names = ['A1', 'A2', 'A3']
      for (const [i, name] of names.entries()) {
        await newOrg(name, { balance: 40, createdAt: ago(10 - i) })
      }
      const first = await list({ page: 1, pageSize: 2 })
      expect(first.items.map((o) => o.name)).toEqual(['A3', 'A2'])
      expect(first.total).toBe(3)
      const second = await list({ page: 2, pageSize: 2 })
      expect(second.items.map((o) => o.name)).toEqual(['A1'])
      expect(second.page).toBe(2)
      // страница за пределами пуста, total сохраняется
      const far = await list({ page: 9, pageSize: 2 })
      expect(far.items).toEqual([])
      expect(far.total).toBe(3)
    })
  })

  describe('get', () => {
    it('returns profile, modules, stats, group audit and balance history without secrets', async () => {
      const org = await newOrg('Alpha', {
        balance: 7,
        city: 'Минск',
        publicPageEnabled: true,
        subscriptionsEnabled: false,
      })
      await member(org)
      await db.insert(auditLog).values([
        {
          organizationId: org,
          userId: plainId,
          action: 'ownership_transfer.started',
          entityType: 'ownership_transfer',
          entityId: 1,
          newValue: { toUserId: 5, token: 'tok-SECRET' },
          ipAddress: '203.0.113.7',
          createdAt: ago(1),
        },
        {
          organizationId: org,
          action: 'organization.updated',
          entityType: 'organization',
          entityId: org,
          createdAt: ago(10), // старше 7 суток
        },
      ])
      await db.insert(eventBalanceEntries).values({
        organizationId: org,
        delta: 10,
        reason: 'grant',
        balanceAfter: 10,
        actorKind: 'system',
        comment: 'Начисление',
        source: 'test',
        createdAt: ago(5),
      })

      const detail = await platformOrganizationsService.get({ userId: rootId }, org, now)
      expect(detail).toMatchObject({
        id: org,
        name: 'Alpha',
        city: 'Минск',
        status: 'active',
        deletedAt: null,
        owner: { id: plainId, telegramUsername: 'owner_one' },
        modules: { subscriptions: false, publicPage: true, seoIndex: false },
        stats: { balance: 7, lowBalance: true, members: 1, eventsMonth: 0 },
        balanceHistory: [{ delta: 10, balanceAfter: 10, reason: 'grant' }],
      })
      expect(detail.recentAudit).toHaveLength(1)
      expect(detail.recentAudit[0]).toMatchObject({
        action: 'ownership_transfer.started',
        actor: { id: plainId },
        newValue: { toUserId: 5, token: '[скрыто]' },
      })
      const json = JSON.stringify(detail)
      expect(json).not.toContain('tok-SECRET')
      expect(json).not.toContain('203.0.113.7')
    })

    it('shows archived and deleted groups, answers organization.not_found otherwise', async () => {
      const gone = await newOrg('Gone', { deletedAt: ago(1), restoreUntil: ago(-29) })
      const detail = await platformOrganizationsService.get({ userId: rootId }, gone, now)
      expect(detail.deletedAt).toBe(ago(1).toISOString())
      await expect(
        platformOrganizationsService.get({ userId: rootId }, 999_999, now),
      ).rejects.toMatchObject({ code: 'organization.not_found' })
    })
  })

  describe('create', () => {
    const create = (input: Parameters<typeof platformOrganizationsService.create>[1]) =>
      platformOrganizationsService.create({ userId: rootId }, input)

    it('creates the group for the owner found by email, with membership, demo quota and audit by root', async () => {
      const owner = await newUser('boss', { email: 'Boss@VT.test' })
      const created = await create({
        name: 'VolleyTime Гомель',
        city: 'Гомель',
        owner: 'boss@vt.test',
      })

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, created.id),
      })
      expect(org).toMatchObject({ name: 'VolleyTime Гомель', city: 'Гомель', ownerUserId: owner })
      expect(created.slug).toBe(org!.slug)
      const members = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, created.id))
      expect(members).toMatchObject([{ userId: owner, role: 'owner', status: 'active' }])
      const [balance] = await db
        .select()
        .from(organizationEventBalances)
        .where(eq(organizationEventBalances.organizationId, created.id))
      expect(balance!.balance).toBeGreaterThan(0)

      const audit = await db.select().from(auditLog).where(eq(auditLog.organizationId, created.id))
      const orgCreated = audit.find((a) => a.action === 'organization.created')!
      expect(orgCreated.userId).toBe(rootId)
      expect(orgCreated.newValue).toMatchObject({
        name: 'VolleyTime Гомель',
        slug: created.slug,
        ownerUserId: owner,
        createdByRoot: true,
      })
      expect(audit.map((a) => a.action)).toContain('member.added')
    })

    it('finds the owner by Telegram username (with or without @, any case)', async () => {
      const owner = await newUser('tg', { telegramUsername: 'Vova_TG' })
      const a = await create({ name: 'Group A', slug: 'group-a', owner: '@vova_tg' })
      const b = await create({ name: 'Group B', slug: 'group-b', owner: 'VOVA_TG' })
      for (const created of [a, b]) {
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.id, created.id),
        })
        expect(org!.ownerUserId).toBe(owner)
      }
    })

    it('uses the given slug, and rejects a taken one without leaving anything behind', async () => {
      await newUser('boss', { email: 'boss@vt.test' })
      await create({ name: 'First', slug: 'vt-gomel', owner: 'boss@vt.test' })
      const before = { orgs: await db.$count(organizations), audit: await db.$count(auditLog) }
      await expect(
        create({ name: 'Second', slug: 'vt-gomel', owner: 'boss@vt.test' }),
      ).rejects.toMatchObject({ code: 'organization.slug_taken' })
      expect(await db.$count(organizations)).toBe(before.orgs)
      expect(await db.$count(auditLog)).toBe(before.audit)
    })

    it('rejects an unknown, ambiguous or inactive owner and writes nothing', async () => {
      await newUser('t1', { telegramUsername: 'twin' })
      await newUser('t2', { telegramUsername: 'twin' })
      await newUser('off', { email: 'off@vt.test', isActive: false })
      const cases: [string, string][] = [
        ['nobody@vt.test', 'platform.owner_not_found'],
        ['@nobody', 'platform.owner_not_found'],
        ['@twin', 'platform.owner_ambiguous'],
        ['off@vt.test', 'platform.owner_inactive'],
      ]
      for (const [owner, code] of cases) {
        await expect(create({ name: 'Group X', owner }), owner).rejects.toMatchObject({ code })
      }
      expect(await db.$count(organizations)).toBe(0)
      expect(await db.$count(auditLog)).toBe(0)
    })

    it('writes the group and its audit records in the caller transaction', async () => {
      await newUser('boss', { email: 'boss@vt.test' })
      class Rollback extends Error {}
      await expect(
        db.transaction(async (tx) => {
          await platformOrganizationsService.create(
            { userId: rootId, db: tx },
            { name: 'Atomic', owner: 'boss@vt.test' },
          )
          expect(await tx.$count(auditLog)).toBeGreaterThan(0)
          throw new Rollback()
        }),
      ).rejects.toBeInstanceOf(Rollback)
      expect(await db.$count(organizations)).toBe(0)
      expect(await db.$count(auditLog)).toBe(0)
      expect(await db.$count(eventBalanceEntries)).toBe(0)
    })
  })
})
