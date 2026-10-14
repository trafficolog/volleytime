import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'
import { organizationSettingsService } from '../organizations/settings'

import { levelService } from './service'

describe('levels (integration, 19.2.3)', () => {
  let ownerId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  const newUser = async () =>
    (
      await db
        .insert(users)
        .values({ email: `lvl-${Math.random()}@t.by` })
        .returning()
    )[0]!.id

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser()
    otherOwnerId = await newUser()
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Lvl' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Other' })).id
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('lists the directory in scale order', async () => {
    const levels = await levelService.list({ userId: ownerId })
    expect(levels.map((l) => l.code)).toEqual(['v1', 'v2', 'v3', 'v4', 'v4_plus'])
    expect(levels[4]).toMatchObject({ title: 'В4+', sortOrder: 5 })
  })

  it('setLevel assigns, clears, is idempotent and scoped to the context organization', async () => {
    const ctx = { userId: ownerId }
    const m = await memberService.add(ctx, { organizationId: orgId, userId: await newUser() })
    expect(m.level).toBeNull()
    expect((await memberService.setLevel(ctx, m.id, { level: 'v3' })).level).toBe('v3')
    expect((await memberService.setLevel(ctx, m.id, { level: 'v3' })).level).toBe('v3')
    expect((await memberService.setLevel(ctx, m.id, { level: null })).level).toBeNull()
    await expect(memberService.setLevel(ctx, m.id, { level: 'A' as never })).rejects.toThrow()

    const org = await organizationService.getById(ctx, orgId)
    const foreign = await memberService.add(
      { userId: otherOwnerId },
      { organizationId: otherOrgId, userId: await newUser() },
    )
    await expect(
      memberService.setLevel({ ...ctx, organization: org }, foreign.id, { level: 'v1' }),
    ).rejects.toMatchObject({ code: 'member.not_found' })
  })

  it('setLevel refuses blocked members but accepts applicants and guests', async () => {
    const ctx = { userId: ownerId }
    const pending = await memberService.add(ctx, {
      organizationId: orgId,
      userId: await newUser(),
      status: 'pending',
    })
    const guest = await memberService.add(ctx, {
      organizationId: orgId,
      userId: await newUser(),
      status: 'guest',
    })
    expect((await memberService.setLevel(ctx, pending.id, { level: 'v4' })).level).toBe('v4')
    expect((await memberService.setLevel(ctx, guest.id, { level: 'v4_plus' })).level).toBe(
      'v4_plus',
    )
    await memberService.block(ctx, pending.id)
    await expect(memberService.setLevel(ctx, pending.id, { level: 'v1' })).rejects.toMatchObject({
      code: 'member.level_not_assignable',
    })
  })

  it('group levels: stored in scale order, change detected for arrays, empty clears', async () => {
    const ctx = { userId: ownerId }
    const a = await organizationSettingsService.update(ctx, orgId, { levels: ['v3', 'v1', 'v3'] })
    expect(a.levels).toEqual(['v1', 'v3'])
    // тот же набор в другом порядке — не изменение
    const same = await organizationSettingsService.update(ctx, orgId, { levels: ['v3', 'v1'] })
    expect(same.levels).toEqual(['v1', 'v3'])
    expect((await organizationSettingsService.update(ctx, orgId, { levels: [] })).levels).toEqual(
      [],
    )
    await expect(
      organizationSettingsService.update(ctx, orgId, { levels: ['v9' as never] }),
    ).rejects.toThrow()
  })
})
