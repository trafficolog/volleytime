import { auditLog, closeDb, db, organizations, users } from '@volley-time/db'
import { grantPlatformRole } from '@volley-time/db/test-utils'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '../permissions/errors'

import { platformAuditService } from './audit-log'

/**
 * Task 22.1.2: платформенный журнал действий для root. Часы фиксированы (`now`), поэтому результат
 * не зависит от даты запуска и часового пояса раннера.
 */
describe('platformAuditService (integration)', { timeout: 60_000 }, () => {
  const now = new Date('2026-11-18T12:00:00.000Z')
  const ago = (days: number, hours = 0) =>
    new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000)
  let seq = 0
  let rootId: number
  let plainId: number
  let orgA: number
  let orgB: number

  const newUser = async (label: string, isRootAdmin = false, email?: string) => {
    const [u] = await db
      .insert(users)
      .values({ email: email ?? `audit-${label}-${++seq}@t.by`, name: label })
      .returning()
    if (isRootAdmin) await grantPlatformRole(u!.id)
    return u!.id
  }
  const newOrg = async (name: string): Promise<number> =>
    (
      await db
        .insert(organizations)
        .values({ name, slug: `audit-${name}-${++seq}`, ownerUserId: plainId })
        .returning()
    )[0]!.id
  const entry = async (
    action: string,
    createdAt: Date,
    extra: Partial<typeof auditLog.$inferInsert> = {},
  ) =>
    (
      await db
        .insert(auditLog)
        .values({
          action,
          entityType: 'organization',
          entityId: 1,
          createdAt,
          ...extra,
        })
        .returning()
    )[0]!.id
  const list = (params: Parameters<typeof platformAuditService.list>[1] = {}) =>
    platformAuditService.list({ userId: rootId }, params, now)

  beforeEach(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    rootId = await newUser('root', true, 'root@vt.test')
    plainId = await newUser('plain')
    orgA = await newOrg('Alpha')
    orgB = await newOrg('Beta')
  })
  afterAll(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('refuses a non-root user, reading the flag from the database', async () => {
    await expect(platformAuditService.list({ userId: plainId }, {}, now)).rejects.toBeInstanceOf(
      ForbiddenError,
    )
    await expect(platformAuditService.list({ userId: 999_999 }, {}, now)).rejects.toBeInstanceOf(
      ForbiddenError,
    )
  })

  it('is read-only: the service exposes no way to change the log', () => {
    expect(Object.keys(platformAuditService)).toEqual(['list'])
  })

  it('returns newest first (append-only, by id) with actor, organization and the system actor as null', async () => {
    const oldest = await entry('organization.created', ago(2), {
      organizationId: orgA,
      userId: plainId,
    })
    const middle = await entry('member.blocked', ago(1), {
      organizationId: orgB,
      userId: plainId,
      newValue: { reason: 'spam' },
    })
    const newest = await entry('plan.updated', ago(0, 1), { entityType: 'plan' })

    const page = await list()
    expect(page.entries.map((e) => e.id)).toEqual([newest, middle, oldest])
    expect(page.total).toBe(3)
    expect(page.nextCursor).toBeNull()
    expect(page.entries[0]).toMatchObject({ actor: null, organization: null, entityType: 'plan' })
    expect(page.entries[1]).toMatchObject({
      actor: { id: plainId, name: 'plain' },
      organization: { id: orgB, name: 'Beta' },
      newValue: { reason: 'spam' },
      createdAt: ago(1).toISOString(),
    })
  })

  it('defaults to the last 7 days and honours the period filter', async () => {
    const d60 = await entry('organization.updated', ago(60))
    const d20 = await entry('organization.updated', ago(20))
    const d6 = await entry('organization.updated', ago(6))
    const d1 = await entry('organization.updated', ago(0, 2))

    expect((await list()).entries.map((e) => e.id)).toEqual([d1, d6])
    expect((await list({ period: '24h' })).entries.map((e) => e.id)).toEqual([d1])
    expect((await list({ period: '30d' })).entries.map((e) => e.id)).toEqual([d1, d6, d20])
    expect((await list({ period: 'all' })).entries.map((e) => e.id)).toEqual([d1, d6, d20, d60])
  })

  it('filters by organization and lists only organizations that have entries in the period', async () => {
    const a = await entry('organization.updated', ago(1), { organizationId: orgA })
    await entry('organization.updated', ago(1), { organizationId: orgB })
    await entry('organization.updated', ago(40), { organizationId: orgB })

    const onlyA = await list({ organizationId: orgA })
    expect(onlyA.entries.map((e) => e.id)).toEqual([a])
    expect(onlyA.total).toBe(1)
    // фильтр по группе не сужает список групп для выбора
    expect(onlyA.organizations).toEqual([
      { id: orgA, name: 'Alpha' },
      { id: orgB, name: 'Beta' },
    ])
  })

  it('filters by category', async () => {
    const balance = await entry('event_balance.purchase_requested', ago(1))
    const plan = await entry('plan.created', ago(1))
    const subscription = await entry('subscription.purchased', ago(1))
    const org = await entry('organization.deleted', ago(1))
    const owner = await entry('ownership_transfer.started', ago(1))
    const settings = await entry('organization.settings_updated', ago(1))
    const venue = await entry('venue.created', ago(1))
    const booking = await entry('booking.created', ago(1))

    const ids = async (category: NonNullable<Parameters<typeof list>[0]>) =>
      (await list(category)).entries.map((e) => e.id).sort((x, y) => x - y)
    expect(await ids({ category: 'balance' })).toEqual([balance])
    expect(await ids({ category: 'plans' })).toEqual([plan, subscription])
    expect(await ids({ category: 'organizations' })).toEqual([org, owner])
    expect(await ids({ category: 'settings' })).toEqual([settings, venue])
    // без категории видны и действия вне четырёх разделов
    expect((await list()).total).toBe(8)
    expect(booking).toBeGreaterThan(0)
  })

  it('searches the action and the actor name or email, treating % and _ literally', async () => {
    const maria = await newUser('Maria', false, 'maria.k@t.by')
    const byAction = await entry('plan.archived', ago(1))
    const byName = await entry('organization.updated', ago(1), { userId: maria })
    await entry('organization.updated', ago(1), { userId: plainId })

    expect((await list({ q: 'plan.arch' })).entries.map((e) => e.id)).toEqual([byAction])
    expect((await list({ q: 'maria' })).entries.map((e) => e.id)).toEqual([byName])
    expect((await list({ q: 'MARIA.K@' })).entries.map((e) => e.id)).toEqual([byName])
    expect((await list({ q: '%' })).entries).toEqual([])
    expect((await list({ q: 'plan_archived' })).entries).toEqual([])
    expect((await list({ q: '   ' })).total).toBe(3)
  })

  it('pages with a cursor and reports the total', async () => {
    const ids: number[] = []
    for (let i = 0; i < 5; i++) ids.push(await entry('organization.updated', ago(1, i)))
    const newestFirst = [...ids].sort((a, b) => b - a)

    const first = await list({ limit: 2 })
    expect(first.entries.map((e) => e.id)).toEqual(newestFirst.slice(0, 2))
    expect(first.total).toBe(5)
    expect(first.nextCursor).toBe(newestFirst[1])

    const second = await list({ limit: 2, cursor: first.nextCursor! })
    expect(second.entries.map((e) => e.id)).toEqual(newestFirst.slice(2, 4))
    expect(second.total).toBe(5)

    const last = await list({ limit: 2, cursor: second.nextCursor! })
    expect(last.entries.map((e) => e.id)).toEqual(newestFirst.slice(4))
    expect(last.nextCursor).toBeNull()
  })

  it('never exposes tokens, secrets or links in old/new values', async () => {
    await entry('ownership_transfer.started', ago(1), {
      entityType: 'ownership_transfer',
      newValue: {
        toUserId: 5,
        token: 'tok-SECRET-1',
        nested: { inviteCode: 'CODE-2', apiKey: 'key-3', keep: 'ok' },
        list: [{ password: 'pw-4' }, 'fine'],
        link: 'https://t.me/bot?start=tok-SECRET-1',
      },
      oldValue: { tokenHash: 'hash-5', status: 'pending' },
    })

    const page = await list()
    const json = JSON.stringify(page)
    for (const secret of ['tok-SECRET-1', 'CODE-2', 'key-3', 'pw-4', 'hash-5']) {
      expect(json).not.toContain(secret)
    }
    expect(page.entries[0]!.newValue).toMatchObject({
      toUserId: 5,
      nested: { keep: 'ok' },
    })
    expect(page.entries[0]!.oldValue).toMatchObject({ status: 'pending' })
    // и ip/user-agent в журнал платформы не попадают
    expect(page.entries[0]).not.toHaveProperty('ipAddress')
    expect(page.entries[0]).not.toHaveProperty('userAgent')
  })

  it('clamps the limit', async () => {
    for (let i = 0; i < 3; i++) await entry('organization.updated', ago(1, i))
    expect((await list({ limit: 0 })).entries).toHaveLength(1)
    expect((await list({ limit: 10_000 })).entries).toHaveLength(3)
  })
})
