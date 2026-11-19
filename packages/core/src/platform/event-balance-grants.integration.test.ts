import {
  auditLog,
  closeDb,
  db,
  eq,
  eventBalanceEntries,
  organizationEventBalances,
  organizations,
  sql,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { eventBalanceService } from '../event-balance/service'
import { organizationService } from '../organizations/service'
import { ForbiddenError } from '../permissions/errors'

import { platformEventBalanceGrantsService } from './event-balance-grants'

/** Task 22.2.2: ручное начисление баланса событий root (R-03). */
describe('platformEventBalanceGrantsService (integration)', { timeout: 60_000 }, () => {
  let rootId: number
  let plainId: number
  let orgId: number
  let seq = 0
  const key = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`
  const input = (over: Record<string, unknown> = {}) =>
    ({
      organizationId: orgId,
      units: 10,
      category: 'promo',
      comment: 'Промо за участие в Private Beta',
      idempotencyKey: key(),
      ...over,
    }) as never
  const grant = (over: Record<string, unknown> = {}, user = rootId) =>
    platformEventBalanceGrantsService.grant({ userId: user }, input(over))
  const balance = async () => (await eventBalanceService.get({ userId: plainId }, orgId)).balance
  const grantEntries = () =>
    db.select().from(eventBalanceEntries).where(eq(eventBalanceEntries.reason, 'grant'))
  const grantAudits = () => db.$count(auditLog, eq(auditLog.action, 'event_balance.granted'))

  beforeEach(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    ;[rootId, plainId] = (
      await db
        .insert(users)
        .values([
          { name: 'Root', email: 'root@vt.test', isRootAdmin: true },
          { name: 'Plain', email: 'plain@vt.test' },
        ])
        .returning()
    ).map((u) => u.id) as [number, number]
    orgId = (await organizationService.create({ userId: plainId }, { name: 'Grant Org' })).id
  })
  afterAll(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('refuses a non-root user and changes nothing', async () => {
    const before = await balance()
    await expect(grant({}, plainId)).rejects.toBeInstanceOf(ForbiddenError)
    expect(await balance()).toBe(before)
    expect(await grantEntries()).toEqual([])
  })

  it('credits the ledger, projection and audit in one operation, visible to the organizer', async () => {
    const before = await balance()
    const k = key()
    const res = await grant({ units: 7, idempotencyKey: k })
    expect(res).toMatchObject({
      organization: { id: orgId, name: 'Grant Org' },
      delta: 7,
      balanceAfter: before + 7,
      category: 'promo',
      comment: 'Промо за участие в Private Beta',
      replayed: false,
    })
    // организатор видит начисленный баланс и запись в своей истории
    expect(await balance()).toBe(before + 7)
    const history = await eventBalanceService.listEntries({ userId: plainId }, orgId, {})
    expect(history.entries[0]).toMatchObject({
      delta: 7,
      reason: 'grant',
      balanceAfter: before + 7,
      author: { id: rootId },
      comment: 'Промо за участие в Private Beta',
    })
    const [entry] = await grantEntries()
    expect(entry).toMatchObject({ actorKind: 'user', createdByUserId: rootId, delta: 7 })
    const [audit] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'event_balance.granted'))
    expect(audit).toMatchObject({
      organizationId: orgId,
      userId: rootId,
      entityType: 'event_balance_entry',
      entityId: entry!.id,
    })
    expect(audit!.newValue).toMatchObject({
      delta: 7,
      balanceAfter: before + 7,
      category: 'promo',
      comment: 'Промо за участие в Private Beta',
      idempotencyKey: k,
      source: 'root-admin',
    })
  })

  it('requires a reason: blank, whitespace or too short is refused before any write', async () => {
    const before = await balance()
    for (const comment of [undefined, '', '   ', 'ab', 'x'.repeat(501)]) {
      await expect(grant({ comment }), String(comment)).rejects.toMatchObject({ name: 'ZodError' })
    }
    expect(await balance()).toBe(before)
    expect(await grantEntries()).toEqual([])
    expect(await grantAudits()).toBe(0)
  })

  it('validates bounds, category, organization id and key', async () => {
    for (const bad of [
      { units: 0 },
      { units: -5 },
      { units: 1.5 },
      { units: 1001 },
      { units: Number.NaN },
      { units: '5' },
      { category: 'gift' },
      { organizationId: 0 },
      { organizationId: 2_147_483_648 },
      { idempotencyKey: 'not-a-uuid' },
      { idempotencyKey: undefined },
      { extra: 1 },
    ]) {
      await expect(grant(bad), JSON.stringify(bad)).rejects.toMatchObject({ name: 'ZodError' })
    }
    expect(await grantEntries()).toEqual([])
    // граница включена
    const before = await balance()
    expect((await grant({ units: 1000 })).balanceAfter).toBe(before + 1000)
    expect((await grant({ units: 1 })).balanceAfter).toBe(before + 1001)
  })

  it('is idempotent against a double submit with the same key', async () => {
    const before = await balance()
    const same = input({ units: 4 })
    const first = await platformEventBalanceGrantsService.grant({ userId: rootId }, same)
    const second = await platformEventBalanceGrantsService.grant({ userId: rootId }, same)
    expect(first.replayed).toBe(false)
    expect(second).toMatchObject({
      replayed: true,
      entryId: first.entryId,
      balanceAfter: before + 4,
    })
    expect(await balance()).toBe(before + 4)
    expect(await grantEntries()).toHaveLength(1)
    expect(await grantAudits()).toBe(1)
  })

  it('credits once when the same submit races in parallel', async () => {
    const before = await balance()
    const same = input({ units: 3 })
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        platformEventBalanceGrantsService.grant({ userId: rootId }, same),
      ),
    )
    expect(results.filter((r) => !r.replayed)).toHaveLength(1)
    expect(new Set(results.map((r) => r.entryId)).size).toBe(1)
    expect(await balance()).toBe(before + 3)
    expect(await grantEntries()).toHaveLength(1)
  })

  it('reusing a key for a different grant is a conflict and credits nothing more', async () => {
    const before = await balance()
    const k = key()
    await grant({ units: 2, idempotencyKey: k })
    await expect(grant({ units: 9, idempotencyKey: k })).rejects.toMatchObject({
      code: 'platform.grant_idempotency_conflict',
    })
    await expect(
      grant({ units: 2, comment: 'Другая причина', idempotencyKey: k }),
    ).rejects.toMatchObject({ code: 'platform.grant_idempotency_conflict' })
    expect(await balance()).toBe(before + 2)
    expect(await grantEntries()).toHaveLength(1)
  })

  it('distinct keys credit separately', async () => {
    const before = await balance()
    await grant({ units: 2 })
    await grant({ units: 2 })
    expect(await balance()).toBe(before + 4)
    expect(await grantEntries()).toHaveLength(2)
  })

  it('refuses an unknown or deleted organization', async () => {
    await expect(grant({ organizationId: 999_999 })).rejects.toMatchObject({
      code: 'organization.not_found',
    })
    await db
      .update(organizations)
      .set({ deletedAt: sql`now()`, restoreUntil: sql`now() + interval '30 days'` })
      .where(eq(organizations.id, orgId))
    await expect(grant()).rejects.toMatchObject({ code: 'platform.grant_org_deleted' })
    expect(await grantEntries()).toEqual([])
  })

  it('creates the projection row lazily for an organization without a balance', async () => {
    await db
      .delete(organizationEventBalances)
      .where(eq(organizationEventBalances.organizationId, orgId))
    expect((await grant({ units: 5 })).balanceAfter).toBe(5)
  })

  it('lists grants newest first with keyset pagination, organization, category and actor', async () => {
    await grant({ units: 1, category: 'bugfix', comment: 'Багфикс #142' })
    await grant({ units: 2, category: 'manual', comment: 'Вручную' })
    await grant({ units: 3, comment: 'Третье' })
    const page1 = await platformEventBalanceGrantsService.list({ userId: rootId }, { limit: 2 })
    expect(page1.entries.map((e) => e.delta)).toEqual([3, 2])
    expect(page1.entries[0]).toMatchObject({
      organization: { id: orgId, name: 'Grant Org' },
      category: 'promo',
      comment: 'Третье',
      actor: { id: rootId, name: 'Root' },
    })
    expect(page1.nextCursor).not.toBeNull()
    const page2 = await platformEventBalanceGrantsService.list(
      { userId: rootId },
      { limit: 2, cursor: page1.nextCursor! },
    )
    expect(page2.entries.map((e) => [e.delta, e.category])).toEqual([[1, 'bugfix']])
    expect(page2.nextCursor).toBeNull()
    await expect(
      platformEventBalanceGrantsService.list({ userId: plainId }, {}),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})
