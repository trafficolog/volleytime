import { closeDb, db, eq, organizations, platformStaff, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'

import type { ForbiddenError } from './errors'
import { assertPlatformRole, assertRootAdmin, getPlatformRole } from './root'

const code = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: ForbiddenError) => e.code,
  )

describe('platform staff policy (19.3.1, 29.3.1)', () => {
  let rootId: number, ownerId: number, supportId: number

  const newUser = async (label: string, extra: Partial<typeof users.$inferInsert> = {}) =>
    (
      await db
        .insert(users)
        .values({ email: `${label}-${Math.random()}@t.by`, ...extra })
        .returning()
    )[0]!.id

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    rootId = await newUser('root')
    supportId = await newUser('support')
    ownerId = await newUser('owner')
    await db.insert(platformStaff).values([
      { userId: rootId, role: 'owner' },
      { userId: supportId, role: 'support' },
    ])
    await organizationService.create({ userId: ownerId }, { name: 'Owner org' })
  })

  it('platform owner passes any policy', async () => {
    expect(await assertRootAdmin({ userId: rootId })).toBe('owner')
    expect(await assertRootAdmin({ userId: rootId }, 'team')).toBe('owner')
  })

  it('organization owner and unknown user are not staff (forbidden.root_only)', async () => {
    expect(await code(assertRootAdmin({ userId: ownerId }))).toBe('forbidden.root_only')
    expect(await code(assertRootAdmin({ userId: 2_000_000_000 }))).toBe('forbidden.root_only')
  })

  it('the legacy flag alone gives no access', async () => {
    await db.update(users).set({ isRootAdmin: true }).where(eq(users.id, ownerId))
    expect(await code(assertRootAdmin({ userId: ownerId }))).toBe('forbidden.root_only')
  })

  it('role outside the policy gets forbidden.platform_role', async () => {
    expect(await assertRootAdmin({ userId: supportId }, 'groupPages')).toBe('support')
    expect(await code(assertRootAdmin({ userId: supportId }, 'groupPagesModerate'))).toBe(
      'forbidden.platform_role',
    )
    expect(await code(assertRootAdmin({ userId: supportId }, 'balanceManage'))).toBe(
      'forbidden.platform_role',
    )
    expect(await code(assertPlatformRole({ userId: supportId }, ['owner']))).toBe(
      'forbidden.platform_role',
    )
  })

  it('role change and removal take effect on the next call (no cached role)', async () => {
    await assertRootAdmin({ userId: rootId }, 'team')
    await db.update(platformStaff).set({ role: 'admin' }).where(eq(platformStaff.userId, rootId))
    expect(await code(assertRootAdmin({ userId: rootId }, 'team'))).toBe('forbidden.platform_role')
    await db.delete(platformStaff).where(eq(platformStaff.userId, rootId))
    expect(await code(assertRootAdmin({ userId: rootId }))).toBe('forbidden.root_only')
  })

  it('a blocked staff member is not staff', async () => {
    await db.update(users).set({ isActive: false }).where(eq(users.id, rootId))
    expect(await getPlatformRole({ userId: rootId })).toBeNull()
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
