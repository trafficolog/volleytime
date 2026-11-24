import {
  and,
  auditLog,
  closeDb,
  db,
  eq,
  organizations,
  platformStaff,
  users,
} from '@volley-time/db'
import { grantPlatformRole } from '@volley-time/db/test-utils'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { getPlatformRole } from '../permissions/root'

import { platformStaffService as staff } from './staff'

const codeOf = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: { code?: string; name?: string }) => e.code ?? e.name,
  )

/**
 * Команда платформы (29.3.1, R-15, D-28): список, приглашение, смена роли и удаление — только
 * Owner; последнего Owner нельзя понизить или удалить; конкурентные изменения не оставляют
 * платформу без Owner; каждое изменение — запись журнала «кто, кому, было → стало».
 */
describe('platformStaffService (integration)', () => {
  let seq = 0
  let owner: number, admin: number, support: number, plain: number

  const newUser = async (label: string, extra: Partial<typeof users.$inferInsert> = {}) => {
    const [u] = await db
      .insert(users)
      .values({ email: `staff-${label}-${++seq}@t.by`, name: label, ...extra })
      .returning()
    return u!
  }
  const roleOf = (userId: number) => getPlatformRole({ userId })
  const staffAudit = () =>
    db
      .select({
        action: auditLog.action,
        actor: auditLog.userId,
        entityId: auditLog.entityId,
        oldValue: auditLog.oldValue,
        newValue: auditLog.newValue,
        organizationId: auditLog.organizationId,
      })
      .from(auditLog)
      .where(eq(auditLog.entityType, 'platform_staff'))
      .orderBy(auditLog.id)
  const flag = async (userId: number) =>
    (await db.select({ f: users.isRootAdmin }).from(users).where(eq(users.id, userId)))[0]!.f

  beforeEach(async () => {
    await db.delete(auditLog).where(eq(auditLog.entityType, 'platform_staff'))
    await db.delete(organizations)
    await db.delete(users)
    owner = (await newUser('owner')).id
    admin = (await newUser('admin')).id
    support = (await newUser('support')).id
    plain = (await newUser('plain', { telegramUsername: 'plain_tg' })).id
    await grantPlatformRole(owner)
    await grantPlatformRole(admin, 'admin')
    await grantPlatformRole(support, 'support')
  })
  afterAll(async () => {
    await db.delete(auditLog).where(eq(auditLog.entityType, 'platform_staff'))
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('only Owner reads and changes the team; others get forbidden.platform_role', async () => {
    const list = await staff.list({ userId: owner })
    expect(list.members.map((m) => [m.userId, m.role])).toEqual([
      [owner, 'owner'],
      [admin, 'admin'],
      [support, 'support'],
    ])
    for (const actor of [admin, support]) {
      expect(await codeOf(staff.list({ userId: actor }))).toBe('forbidden.platform_role')
      expect(
        await codeOf(staff.invite({ userId: actor }, { user: '@plain_tg', role: 'analyst' })),
      ).toBe('forbidden.platform_role')
      expect(await codeOf(staff.changeRole({ userId: actor }, support, { role: 'owner' }))).toBe(
        'forbidden.platform_role',
      )
      expect(await codeOf(staff.remove({ userId: actor }, owner))).toBe('forbidden.platform_role')
    }
    expect(await codeOf(staff.list({ userId: plain }))).toBe('forbidden.root_only')
    expect(await roleOf(owner)).toBe('owner')
    expect(await staffAudit()).toEqual([])
  })

  it('me returns the role and its policies for any member', async () => {
    const me = await staff.me({ userId: support })
    expect(me).toMatchObject({ userId: support, role: 'support' })
    expect(me.policies).toContain('groupPageComplaintsReject')
    expect(me.policies).not.toContain('groupPagesModerate')
    expect(me.policies).not.toContain('balanceManage')
    expect(await codeOf(staff.me({ userId: plain }))).toBe('forbidden.root_only')
  })

  it('invites an existing user with one role and audits who, whom and the role', async () => {
    const member = await staff.invite({ userId: owner }, { user: '@Plain_TG', role: 'analyst' })
    expect(member).toMatchObject({
      userId: plain,
      role: 'analyst',
      invitedBy: { id: owner, name: 'owner' },
    })
    expect(await roleOf(plain)).toBe('analyst')
    expect(await flag(plain)).toBe(false)
    expect(await staffAudit()).toEqual([
      {
        action: 'platform.staff.invited',
        actor: owner,
        entityId: plain,
        oldValue: null,
        newValue: { role: 'analyst' },
        organizationId: null,
      },
    ])
    // одна роль на человека: второе приглашение — 409, роль меняется отдельно
    expect(
      await codeOf(staff.invite({ userId: owner }, { user: '@plain_tg', role: 'finance' })),
    ).toBe('platform.staff_exists')
    expect(await roleOf(plain)).toBe('analyst')
  })

  it('refuses unknown, blocked and malformed invites', async () => {
    const blocked = await newUser('blocked', { isActive: false })
    expect(
      await codeOf(staff.invite({ userId: owner }, { user: 'nobody@t.by', role: 'support' })),
    ).toBe('platform.staff_user_not_found')
    expect(
      await codeOf(staff.invite({ userId: owner }, { user: blocked.email!, role: 'support' })),
    ).toBe('platform.staff_user_inactive')
    expect(await codeOf(staff.invite({ userId: owner }, { user: '@plain_tg', role: 'root' }))).toBe(
      'ZodError',
    )
    expect(
      await codeOf(
        staff.invite({ userId: owner }, { user: '@plain_tg', role: 'support', extra: 1 }),
      ),
    ).toBe('ZodError')
    expect(await staffAudit()).toEqual([])
  })

  it('changes a role from the next call and audits before and after', async () => {
    await staff.changeRole({ userId: owner }, support, { role: 'moderator' })
    expect(await roleOf(support)).toBe('moderator')
    await staff.changeRole({ userId: owner }, admin, { role: 'owner' })
    expect(await flag(admin)).toBe(true)
    const audit = await staffAudit()
    expect(audit.map((a) => [a.action, a.actor, a.entityId, a.oldValue, a.newValue])).toEqual([
      ['platform.staff.role_changed', owner, support, { role: 'support' }, { role: 'moderator' }],
      ['platform.staff.role_changed', owner, admin, { role: 'admin' }, { role: 'owner' }],
    ])
    expect(await codeOf(staff.changeRole({ userId: owner }, admin, { role: 'owner' }))).toBe(
      'platform.staff_same_role',
    )
    expect(await codeOf(staff.changeRole({ userId: owner }, plain, { role: 'admin' }))).toBe(
      'platform.staff_not_found',
    )
  })

  it('the last Owner cannot be demoted or removed, not even by themselves', async () => {
    for (const role of ['admin', 'analyst'] as const) {
      expect(await codeOf(staff.changeRole({ userId: owner }, owner, { role }))).toBe(
        'platform.staff_last_owner',
      )
    }
    expect(await codeOf(staff.remove({ userId: owner }, owner))).toBe('platform.staff_last_owner')
    expect(await roleOf(owner)).toBe('owner')
    expect(await staffAudit()).toEqual([])
  })

  it('with a second Owner one may demote or remove oneself; access ends at once', async () => {
    await staff.changeRole({ userId: owner }, admin, { role: 'owner' })
    await staff.changeRole({ userId: owner }, owner, { role: 'admin' })
    expect(await roleOf(owner)).toBe('admin')
    expect(await flag(owner)).toBe(false)
    expect(await codeOf(staff.list({ userId: owner }))).toBe('forbidden.platform_role')
    await staff.remove({ userId: admin }, owner)
    expect(await roleOf(owner)).toBeNull()
    expect(await codeOf(staff.remove({ userId: admin }, admin))).toBe('platform.staff_last_owner')
    const [last] = (await staffAudit()).slice(-1)
    expect(last).toMatchObject({
      action: 'platform.staff.removed',
      actor: admin,
      entityId: owner,
      oldValue: { role: 'admin' },
      newValue: null,
    })
  })

  it('two Owners demoting each other at once leave exactly one Owner', async () => {
    await staff.changeRole({ userId: owner }, admin, { role: 'owner' })
    const results = await Promise.all([
      codeOf(staff.changeRole({ userId: owner }, admin, { role: 'support' })),
      codeOf(staff.changeRole({ userId: admin }, owner, { role: 'support' })),
    ])
    expect(results.sort()).toEqual(['forbidden.platform_role', 'ok'])
    const owners = await db.select().from(platformStaff).where(eq(platformStaff.role, 'owner'))
    expect(owners).toHaveLength(1)
  })

  it('two Owners removing each other at once leave exactly one Owner', async () => {
    await staff.changeRole({ userId: owner }, admin, { role: 'owner' })
    const results = await Promise.all([
      codeOf(staff.remove({ userId: owner }, admin)),
      codeOf(staff.remove({ userId: admin }, owner)),
    ])
    expect(results.sort()).toEqual(['forbidden.platform_role', 'ok'])
    expect(
      await db.select().from(platformStaff).where(eq(platformStaff.role, 'owner')),
    ).toHaveLength(1)
  })

  it('parallel invites of one person give one membership and one audit record', async () => {
    const results = await Promise.all([
      codeOf(staff.invite({ userId: owner }, { user: '@plain_tg', role: 'support' })),
      codeOf(staff.invite({ userId: owner }, { user: '@plain_tg', role: 'finance' })),
    ])
    expect(results.sort()).toEqual(['ok', 'platform.staff_exists'])
    expect(
      await db.select().from(platformStaff).where(eq(platformStaff.userId, plain)),
    ).toHaveLength(1)
    expect(
      await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entityType, 'platform_staff'), eq(auditLog.entityId, plain))),
    ).toHaveLength(1)
  })
})
