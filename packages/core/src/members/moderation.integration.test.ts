import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { organizationService } from '../organizations/service'

import { memberService } from './service'

describe('member moderation (integration, 4.9.8)', () => {
  let ownerId: number
  let orgId: number
  const newUser = async () =>
    (
      await db
        .insert(users)
        .values({ email: `mod-${Math.random()}@t.by` })
        .returning()
    )[0]!.id

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser()
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Mod Org' })).id
  })

  it('approve / reject pending', async () => {
    const o = { userId: ownerId }
    const a = await memberService.add(o, {
      organizationId: orgId,
      userId: await newUser(),
      status: 'pending',
    })
    const b = await memberService.add(o, {
      organizationId: orgId,
      userId: await newUser(),
      status: 'pending',
    })
    const approved = await memberService.approve(o, a.id)
    expect(approved.status).toBe('active')
    expect(approved.joinedAt).not.toBeNull()
    expect((await memberService.reject(o, b.id)).status).toBe('rejected')
    await expect(memberService.approve(o, a.id)).rejects.toThrow(/Cannot change member status/)
  })

  it('block / unblock', async () => {
    const o = { userId: ownerId }
    const m = await memberService.add(o, { organizationId: orgId, userId: await newUser() })
    expect((await memberService.block(o, m.id)).status).toBe('blocked')
    expect((await memberService.unblock(o, m.id)).status).toBe('active')
    await expect(memberService.unblock(o, m.id)).rejects.toThrow(/Cannot change/)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
