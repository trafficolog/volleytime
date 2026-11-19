import {
  auditLog,
  bookings,
  closeDb,
  db,
  eq,
  events,
  organizationMembers,
  organizations,
  sessions,
  sql,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '../permissions/errors'

import { PlatformUserError } from './errors'
import { platformUsersService } from './users'

/**
 * Task 22.1.4: пользователи платформы для root. Часы фиксированы (`now`), окно активности
 * скользящее, поэтому результат не зависит от даты запуска и часового пояса раннера.
 */
describe('platformUsersService (integration)', { timeout: 60_000 }, () => {
  const now = new Date('2026-11-18T12:00:00.000Z')
  const ago = (days: number, hours = 0) =>
    new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000)
  let seq = 0
  let rootId: number
  let plainId: number
  let orgId: number
  let eventId: number

  const newUser = async (
    label: string,
    extra: Partial<typeof users.$inferInsert> = {},
  ): Promise<number> =>
    (
      await db
        .insert(users)
        .values({ email: `usr-${label}-${++seq}@t.by`, name: label, createdAt: ago(60), ...extra })
        .returning()
    )[0]!.id
  const join = (
    userId: number,
    role: 'owner' | 'organizer' | 'assistant' | 'player',
    status: 'active' | 'pending' | 'blocked' = 'active',
    org = orgId,
  ) => db.insert(organizationMembers).values({ organizationId: org, userId, role, status })
  const book = (
    userId: number,
    createdAt: Date,
    status: 'confirmed' | 'cancelled' = 'confirmed',
    onEvent = eventId,
  ) =>
    db.insert(bookings).values({
      eventId: onEvent,
      userId,
      organizationId: orgId,
      status,
      method: 'cash',
      createdAt,
    })
  const session = (userId: number, updatedAt: Date) =>
    db.insert(sessions).values({
      userId,
      token: `tok-${userId}-${++seq}`,
      expiresAt: new Date(now.getTime() + 86_400_000),
      updatedAt,
    })

  const list = (params: Parameters<typeof platformUsersService.list>[1] = {}) =>
    platformUsersService.list({ userId: rootId }, params, now)
  const actions = async (entityId: number) =>
    (await db.select().from(auditLog).where(eq(auditLog.entityId, entityId))).filter(
      (a) => a.entityType === 'user',
    )

  async function clean() {
    await db.delete(auditLog)
    await db.delete(bookings)
    await db.delete(events)
    await db.delete(organizationMembers)
    await db.delete(organizations)
    await db.delete(sessions)
    await db.delete(users)
  }

  beforeEach(async () => {
    await clean()
    rootId = await newUser('root', { isRootAdmin: true })
    plainId = await newUser('plain')
    orgId = (
      await db
        .insert(organizations)
        .values({ name: 'Group', slug: `grp-${++seq}`, ownerUserId: plainId })
        .returning()
    )[0]!.id
    eventId = (
      await db
        .insert(events)
        .values({
          organizationId: orgId,
          createdByUserId: plainId,
          title: 'E',
          startsAt: ago(1),
          endsAt: ago(1, -2),
          capacity: 10,
          status: 'published',
        })
        .returning()
    )[0]!.id
  })
  afterAll(async () => {
    await clean()
    await closeDb()
  })

  describe('access', () => {
    it('forbids every method for a non-root user and for an unknown user, changing nothing', async () => {
      const target = await newUser('target')
      const ctx = { userId: plainId }
      for (const call of [
        () => platformUsersService.list(ctx),
        () => platformUsersService.get(ctx, target),
        () => platformUsersService.block(ctx, target),
        () => platformUsersService.unblock(ctx, target),
      ]) {
        await expect(call()).rejects.toBeInstanceOf(ForbiddenError)
      }
      await expect(platformUsersService.list({ userId: 999_999 })).rejects.toBeInstanceOf(
        ForbiddenError,
      )
      expect((await db.select().from(users).where(eq(users.id, target)))[0]!.isActive).toBe(true)
      expect(await db.$count(auditLog)).toBe(0)
    })

    it('re-reads the root flag from the database on every call', async () => {
      await db.update(users).set({ isRootAdmin: false }).where(eq(users.id, rootId))
      await expect(list()).rejects.toBeInstanceOf(ForbiddenError)
    })
  })

  describe('list', () => {
    it('shows PII only through the allowed fields: no phone, no numeric telegram id, no secrets', async () => {
      await newUser('pii', {
        phone: '+375291112233',
        telegramUserId: 777_000_111n,
        telegramUsername: 'pii_tg',
      })
      const json = JSON.stringify(await list())
      expect(json).toContain('pii_tg')
      for (const hidden of ['+375291112233', '777000111', 'phone', 'telegramUserId']) {
        expect(json).not.toContain(hidden)
      }
    })

    it('reports groups, the top role, bookings without cancelled ones, and linked channels', async () => {
      const multi = await newUser('multi', { telegramUserId: 1n, telegramUsername: 'multi_tg' })
      const second = (
        await db
          .insert(organizations)
          .values({ name: 'G2', slug: `g2-${++seq}`, ownerUserId: plainId })
          .returning()
      )[0]!.id
      await join(multi, 'player')
      await join(multi, 'organizer', 'active', second)
      await book(multi, ago(3))
      const otherEvent = (
        await db
          .insert(events)
          .values({
            organizationId: orgId,
            createdByUserId: plainId,
            title: 'E2',
            startsAt: ago(2),
            endsAt: ago(2, -2),
            capacity: 10,
            status: 'published',
          })
          .returning()
      )[0]!.id
      await book(multi, ago(4), 'cancelled', otherEvent)
      const noTelegram = await newUser('mail-only')
      const pendingOnly = await newUser('pending')
      await join(pendingOnly, 'player', 'pending')

      const page = await list({ pageSize: 100 })
      const row = (id: number) => page.items.find((u) => u.id === id)!
      expect(row(multi)).toMatchObject({
        name: 'multi',
        telegramUsername: 'multi_tg',
        telegramLinked: true,
        groups: 2,
        topRole: 'organizer',
        bookings: 1,
        blocked: false,
        isRootAdmin: false,
      })
      expect(row(noTelegram)).toMatchObject({
        telegramLinked: false,
        telegramUsername: null,
        groups: 0,
        topRole: null,
        bookings: 0,
      })
      expect(row(pendingOnly)).toMatchObject({ groups: 0, topRole: 'pending' })
      expect(row(rootId).isRootAdmin).toBe(true)
    })

    it('takes the last activity from the latest booking or session, else the sign-up date', async () => {
      const viaBooking = await newUser('b', { createdAt: ago(60) })
      await book(viaBooking, ago(2))
      const viaSession = await newUser('s', { createdAt: ago(60) })
      await session(viaSession, ago(0, 1))
      await book(viaSession, ago(9))
      const idle = await newUser('idle', { createdAt: ago(30) })

      const page = await list({ pageSize: 100 })
      const at = (id: number) => page.items.find((u) => u.id === id)!.lastActivityAt
      expect(at(viaBooking)).toBe(ago(2).toISOString())
      expect(at(viaSession)).toBe(ago(0, 1).toISOString())
      expect(at(idle)).toBe(ago(30).toISOString())
      // самые свежие сверху
      const order = page.items.map((u) => u.id)
      expect(order.indexOf(viaSession)).toBeLessThan(order.indexOf(viaBooking))
      expect(order.indexOf(viaBooking)).toBeLessThan(order.indexOf(idle))
    })

    it('counts all, telegram, email, active in 7 days, blocked and new ones, ignoring filters', async () => {
      await newUser('tg', { telegramUserId: 5n, email: null, createdAt: ago(1) })
      await newUser('off', { isActive: false, createdAt: ago(1) })
      const old = await newUser('old', { createdAt: ago(40) })
      await book(old, ago(8))
      const page = await list({ status: 'blocked', q: 'nobody-matches' })
      // root, plain (email, регистрация 60 д назад) + tg, off, old
      expect(page.counts).toEqual({
        all: 5,
        telegram: 1,
        email: 4,
        active: 1, // только tg: у off блокировка не даёт «активен»
        blocked: 1,
        newThisWeek: 2,
      })
      expect(page.total).toBe(0)
    })

    it('filters by status and searches by name, email, telegram name and usr_ id, escaping wildcards', async () => {
      const ivan = await newUser('Иван Петренко', {
        email: 'ivan.p@vt.by',
        telegramUsername: 'ivan_p',
      })
      const blocked = await newUser('Blocked One', { isActive: false })
      await newUser('Percent%User')

      expect((await list({ status: 'blocked' })).items.map((u) => u.id)).toEqual([blocked])
      expect((await list({ status: 'blocked' })).items[0]!.blocked).toBe(true)
      const active = await list({ status: 'active', pageSize: 100 })
      expect(active.items.map((u) => u.id)).not.toContain(blocked)

      for (const q of ['петренко', 'IVAN.P@vt', '@ivan_p', 'ivan_p', `usr_${ivan}`, String(ivan)]) {
        expect(
          (await list({ q })).items.map((u) => u.id),
          q,
        ).toContain(ivan)
      }
      expect((await list({ q: '%' })).items.map((u) => u.name)).toEqual(['Percent%User'])
      // `_` — буквальный символ (в Telegram-имени Ивана), а не «любой символ»
      expect((await list({ q: '_' })).items.map((u) => u.id)).toEqual([ivan])
      expect((await list({ q: '   ' })).total).toBe(await db.$count(users))
    })

    it('paginates in the database with a stable order and a clamped page size', async () => {
      for (let i = 0; i < 5; i++) await newUser(`p${i}`, { createdAt: ago(20 + i) })
      const total = await db.$count(users)
      const p1 = await list({ pageSize: 3, page: 1 })
      const p2 = await list({ pageSize: 3, page: 2 })
      expect(p1.items).toHaveLength(3)
      expect(p1.total).toBe(total)
      expect(p2.page).toBe(2)
      expect(new Set([...p1.items, ...p2.items].map((u) => u.id)).size).toBe(Math.min(total, 6))
      expect((await list({ pageSize: 0 })).pageSize).toBe(1)
      expect((await list({ pageSize: 10_000 })).pageSize).toBe(100)
      expect((await list({ page: -3 })).page).toBe(1)
    })
  })

  describe('get', () => {
    it('returns the profile with memberships, no phone and no secrets', async () => {
      const target = await newUser('target', { phone: '+375290000000', telegramUserId: 42n })
      await join(target, 'player')
      const detail = await platformUsersService.get({ userId: rootId }, target)
      expect(detail).toMatchObject({
        id: target,
        name: 'target',
        groups: 1,
        topRole: 'player',
        memberships: [
          { organizationId: orgId, organizationName: 'Group', role: 'player', status: 'active' },
        ],
        recentAudit: [],
      })
      const json = JSON.stringify(detail)
      expect(json).not.toContain('+375290000000')
      expect(json).not.toContain('"42"')
    })

    it('throws not found for a missing user', async () => {
      await expect(platformUsersService.get({ userId: rootId }, 999_999)).rejects.toMatchObject({
        code: 'platform.user_not_found',
      })
    })
  })

  describe('block and unblock', () => {
    it('blocks: flag off, every session closed, one audit row by root with old and new state', async () => {
      const target = await newUser('target')
      const other = await newUser('other')
      await session(target, now)
      await session(target, ago(1))
      await session(other, now)

      const result = await platformUsersService.block({ userId: rootId }, target)
      expect(result).toEqual({ id: target, blocked: true })

      const [row] = await db.select().from(users).where(eq(users.id, target))
      expect(row!.isActive).toBe(false)
      expect(await db.$count(sessions, eq(sessions.userId, target))).toBe(0)
      expect(await db.$count(sessions, eq(sessions.userId, other))).toBe(1)
      const trail = await actions(target)
      expect(trail).toHaveLength(1)
      expect(trail[0]).toMatchObject({
        action: 'user.blocked',
        userId: rootId,
        organizationId: null,
        oldValue: { isActive: true },
        newValue: { isActive: false },
      })
      expect(JSON.stringify(trail[0])).not.toContain('target-')
    })

    it('shows the block in the list, the counters and the card journal', async () => {
      const target = await newUser('target')
      await platformUsersService.block({ userId: rootId }, target)
      const page = await list({ status: 'blocked' })
      expect(page.items.map((u) => u.id)).toEqual([target])
      expect(page.counts.blocked).toBe(1)
      const detail = await platformUsersService.get({ userId: rootId }, target)
      expect(detail.blocked).toBe(true)
      expect(detail.recentAudit).toMatchObject([
        { action: 'user.blocked', actor: { id: rootId, name: 'root' } },
      ])
    })

    it('unblocks with its own audit row and does not restore sessions', async () => {
      const target = await newUser('target', { isActive: false })
      const result = await platformUsersService.unblock({ userId: rootId }, target)
      expect(result).toEqual({ id: target, blocked: false })
      expect((await db.select().from(users).where(eq(users.id, target)))[0]!.isActive).toBe(true)
      expect(await db.$count(sessions)).toBe(0)
      expect((await actions(target))[0]).toMatchObject({
        action: 'user.unblocked',
        userId: rootId,
        oldValue: { isActive: false },
        newValue: { isActive: true },
      })
    })

    it('refuses a repeated block or unblock without writing an audit row', async () => {
      const target = await newUser('target')
      await expect(platformUsersService.unblock({ userId: rootId }, target)).rejects.toMatchObject({
        code: 'platform.user_not_blocked',
      })
      await platformUsersService.block({ userId: rootId }, target)
      await expect(platformUsersService.block({ userId: rootId }, target)).rejects.toMatchObject({
        code: 'platform.user_already_blocked',
      })
      expect(await actions(target)).toHaveLength(1)
    })

    it('root can neither block themselves nor another root, and nothing is written', async () => {
      const otherRoot = await newUser('root-2', { isRootAdmin: true })
      await session(rootId, now)
      await expect(platformUsersService.block({ userId: rootId }, rootId)).rejects.toMatchObject({
        code: 'platform.user_cannot_block_self',
      })
      await expect(platformUsersService.block({ userId: rootId }, otherRoot)).rejects.toMatchObject(
        { code: 'platform.user_cannot_block_root' },
      )
      expect((await db.select().from(users).where(eq(users.id, otherRoot)))[0]!.isActive).toBe(true)
      expect(await db.$count(sessions)).toBe(1)
      expect(await db.$count(auditLog)).toBe(0)
      expect(PlatformUserError).toBeDefined()
    })

    it('throws not found and writes nothing for a missing user', async () => {
      for (const call of [
        () => platformUsersService.block({ userId: rootId }, 999_999),
        () => platformUsersService.unblock({ userId: rootId }, 999_999),
      ]) {
        await expect(call()).rejects.toMatchObject({ code: 'platform.user_not_found' })
      }
      expect(await db.$count(auditLog)).toBe(0)
    })

    it('rolls the block back as a whole when the audit row cannot be written', async () => {
      const target = await newUser('target')
      await session(target, now)
      // автор журнала — root; если запись журнала падает, ни флаг, ни сессии не меняются
      await db.execute(
        sql`ALTER TABLE audit_log ADD CONSTRAINT audit_log_test_fail CHECK (false) NOT VALID`,
      )
      try {
        await expect(platformUsersService.block({ userId: rootId }, target)).rejects.toBeDefined()
      } finally {
        await db.execute(sql`ALTER TABLE audit_log DROP CONSTRAINT audit_log_test_fail`)
      }
      expect((await db.select().from(users).where(eq(users.id, target)))[0]!.isActive).toBe(true)
      expect(await db.$count(sessions, eq(sessions.userId, target))).toBe(1)
    })
  })
})
