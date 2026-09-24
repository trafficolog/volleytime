import {
  and,
  asc,
  auditLog,
  closeDb,
  db,
  eq,
  organizationMembers,
  organizations,
  sql,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { auditService } from '../audit/service'

import { OrganizationArchivedError, SlugTakenError } from './errors'
import { organizationService } from './service'

let ownerId: number

async function ctx() {
  return { userId: ownerId }
}

describe('organizationService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `own-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
  })

  it('creates org with auto slug from name', async () => {
    const org = await organizationService.create(await ctx(), { name: 'Волейбол Минск' })
    expect(org.slug).toBe('voleybol-minsk')
    expect(org.ownerUserId).toBe(ownerId)
    expect(org.status).toBe('active')
  })

  it('creates owner membership atomically', async () => {
    const org = await organizationService.create(await ctx(), { name: 'Club' })
    const members = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, org.id))
    expect(members).toHaveLength(1)
    expect(members[0]?.role).toBe('owner')
    expect(members[0]?.userId).toBe(ownerId)
  })

  it('generates unique slug on collision', async () => {
    const a = await organizationService.create(await ctx(), { name: 'Team' })
    const b = await organizationService.create(await ctx(), { name: 'Team' })
    expect(a.slug).toBe('team')
    expect(b.slug).toBe('team-2')
  })

  it('rejects explicit slug that is taken', async () => {
    await organizationService.create(await ctx(), { name: 'Org X', slug: 'taken' })
    await expect(
      organizationService.create(await ctx(), { name: 'Org Y', slug: 'taken' }),
    ).rejects.toThrow(SlugTakenError)
  })

  it('validates name length (zod)', async () => {
    await expect(organizationService.create(await ctx(), { name: 'A' })).rejects.toThrow()
  })

  it('updates org fields', async () => {
    const org = await organizationService.create(await ctx(), { name: 'Old Name' })
    const updated = await organizationService.update(await ctx(), org.id, { city: 'Минск' })
    expect(updated.city).toBe('Минск')
  })

  it('toggles subscriptions without changing an omitted flag and audits the change', async () => {
    const org = await organizationService.create(await ctx(), { name: 'Toggle Club' })
    expect(org.subscriptionsEnabled).toBe(true)
    const off = await organizationService.update(await ctx(), org.id, {
      subscriptionsEnabled: false,
    })
    expect(off.subscriptionsEnabled).toBe(false)
    const [change] = await auditService.listByOrg(await ctx(), org.id, {
      action: 'organization.updated',
      entityType: 'organization',
    })
    expect(change?.oldValue).toMatchObject({ subscriptionsEnabled: true })
    expect(change?.newValue).toMatchObject({ subscriptionsEnabled: false })
    const renamed = await organizationService.update(await ctx(), org.id, { name: 'Renamed Club' })
    expect(renamed.subscriptionsEnabled).toBe(false)
    const on = await organizationService.update(await ctx(), org.id, { subscriptionsEnabled: true })
    expect(on.subscriptionsEnabled).toBe(true)
  })

  it('records the actual prior subscription state when two owner updates overlap', async () => {
    const org = await organizationService.create(await ctx(), { name: 'Concurrent Club' })
    let lockAcquired!: () => void
    let releaseLock!: () => void
    let blockerPid = 0
    const acquired = new Promise<void>((resolve) => (lockAcquired = resolve))
    const released = new Promise<void>((resolve) => (releaseLock = resolve))
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(organizations).where(eq(organizations.id, org.id)).for('update')
      const [session] = await tx.execute(sql`SELECT pg_backend_pid()::int AS pid`)
      blockerPid = Number(session?.pid)
      lockAcquired()
      await released
    })
    await acquired
    const updates = Promise.all([
      organizationService.update(await ctx(), org.id, { subscriptionsEnabled: false }),
      organizationService.update(await ctx(), org.id, { subscriptionsEnabled: true }),
    ])
    try {
      let blocked = 0
      for (let attempt = 0; attempt < 100; attempt++) {
        const [state] = await db.execute(
          sql`WITH RECURSIVE waiting(pid) AS (
            SELECT pid FROM pg_stat_activity WHERE ${blockerPid} = ANY(pg_blocking_pids(pid))
            UNION
            SELECT activity.pid FROM pg_stat_activity AS activity, waiting
            WHERE waiting.pid = ANY(pg_blocking_pids(activity.pid))
          ) SELECT count(*)::int AS n FROM waiting`,
        )
        blocked = Number(state?.n)
        if (blocked >= 2) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      expect(blocked).toBeGreaterThanOrEqual(2)
    } finally {
      releaseLock()
    }
    await Promise.all([blocker, updates])
    const changes = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.organizationId, org.id), eq(auditLog.action, 'organization.updated')))
      .orderBy(asc(auditLog.id))

    expect(changes).toHaveLength(2)
    let previous = true
    for (const change of changes) {
      expect(change.oldValue).toMatchObject({ subscriptionsEnabled: previous })
      previous = (change.newValue as { subscriptionsEnabled: boolean }).subscriptionsEnabled
    }
    expect((await organizationService.getById(await ctx(), org.id)).subscriptionsEnabled).toBe(
      previous,
    )
  })

  it('archives org and blocks update afterwards', async () => {
    const org = await organizationService.create(await ctx(), { name: 'ToArchive' })
    await organizationService.archive(await ctx(), org.id)
    await expect(organizationService.update(await ctx(), org.id, { city: 'X' })).rejects.toThrow(
      OrganizationArchivedError,
    )
  })

  it('archived org disappears from listForUser (4.9.10)', async () => {
    const c = await ctx()
    const org = await organizationService.create(c, { name: 'Gone Soon' })
    await organizationService.archive(c, org.id)
    const orgs = await organizationService.listForUser(c)
    expect(orgs.map((o) => o.id)).not.toContain(org.id)
  })

  it('listForUser marks pending membership (4.9.7)', async () => {
    const c = await ctx()
    const org = await organizationService.create(c, { name: 'Pending Org' })
    const [p] = await db
      .insert(users)
      .values({ email: `pend-${Math.random()}@t.by` })
      .returning()
    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: p!.id,
      role: 'player',
      status: 'pending',
    })
    const list = await organizationService.listForUser({ userId: p!.id })
    expect(list.find((o) => o.id === org.id)?.membershipStatus).toBe('pending')
  })

  it('listForUser returns orgs where user is active member', async () => {
    await organizationService.create(await ctx(), { name: 'Org One' })
    await organizationService.create(await ctx(), { name: 'Org Two' })
    const orgs = await organizationService.listForUser(await ctx())
    expect(orgs.length).toBeGreaterThanOrEqual(2)
    expect(orgs.map((o) => o.name)).toContain('Org One')
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
