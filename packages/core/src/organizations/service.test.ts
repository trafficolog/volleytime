import { closeDb, db, eq, organizationMembers, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

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
