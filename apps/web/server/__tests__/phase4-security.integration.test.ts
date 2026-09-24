import { inviteService, memberService, organizationService } from '@volley-time/core'
import { closeDb, db, eq, inviteLinks, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

/** Task 4.9.15: находки ревью Phase 4 через HTTP-слой. */
describe('Phase 4 API security (integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerA: number, organizerA: number, playerA: number, pendingA: number, ownerB: number
  let orgA: number, orgB: number, organizerMemberId: number, playerMemberId: number

  const newUser = async (name: string) =>
    (
      await db
        .insert(users)
        .values({ email: `${name}-${Math.random()}@t.by`, name })
        .returning()
    )[0]!.id

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerA = await newUser('ownerA')
    organizerA = await newUser('organizerA')
    playerA = await newUser('playerA')
    pendingA = await newUser('pendingA')
    ownerB = await newUser('ownerB')
    orgA = (await organizationService.create({ userId: ownerA }, { name: 'Org A' })).id
    orgB = (await organizationService.create({ userId: ownerB }, { name: 'Org B' })).id
    organizerMemberId = (
      await memberService.add(
        { userId: ownerA },
        { organizationId: orgA, userId: organizerA, role: 'organizer' },
      )
    ).id
    playerMemberId = (
      await memberService.add({ userId: ownerA }, { organizationId: orgA, userId: playerA })
    ).id
    await memberService.add(
      { userId: ownerA },
      { organizationId: orgA, userId: pendingA, status: 'pending' },
    )
  })

  it('401 without auth', async () => {
    expect((await request('GET', `/api/organizations/${orgA}/members`)).status).toBe(401)
  })

  it('P0#1: organizer cannot escalate self to owner / change roles', async () => {
    const self = await request('PATCH', `/api/organizations/${orgA}/members/${organizerMemberId}`, {
      user: organizerA,
      body: { role: 'owner' },
    })
    expect(self.status).toBe(403)
    const other = await request('PATCH', `/api/organizations/${orgA}/members/${playerMemberId}`, {
      user: organizerA,
      body: { role: 'organizer' },
    })
    expect(other.status).toBe(403)
    const ownerToOwner = await request(
      'PATCH',
      `/api/organizations/${orgA}/members/${playerMemberId}`,
      {
        user: ownerA,
        body: { role: 'owner' },
      },
    )
    expect(ownerToOwner.status).toBe(422)
    const settings = await request('PATCH', `/api/organizations/${orgA}`, {
      user: organizerA,
      body: { name: 'Hijacked' },
    })
    expect(settings.status).toBe(403)
  })

  it('P0#2: invite deeplink contains bot username', async () => {
    const r = await request('POST', `/api/organizations/${orgA}/invites`, {
      user: ownerA,
      body: {},
    })
    expect(r.status).toBe(200)
    expect((r.body as { deeplinkUrl: string }).deeplinkUrl).toMatch(
      /^https:\/\/t\.me\/[A-Za-z0-9_]{5,}\?start=org_/,
    )
  })

  it('only the owner changes subscription availability', async () => {
    const off = await request('PATCH', `/api/organizations/${orgA}`, {
      user: ownerA,
      body: { subscriptionsEnabled: false },
    })
    expect(off.status).toBe(200)
    expect(off.body).toMatchObject({ organization: { subscriptionsEnabled: false } })
    for (const user of [organizerA, playerA]) {
      expect(
        (
          await request('PATCH', `/api/organizations/${orgA}`, {
            user,
            body: { subscriptionsEnabled: true },
          })
        ).status,
      ).toBe(403)
    }
    expect(
      (
        await request('GET', `/api/organizations/${orgA}`, {
          user: playerA,
        })
      ).body,
    ).toMatchObject({ organization: { subscriptionsEnabled: false } })
    expect(
      (
        await request('GET', `/api/organizations/${orgA}`, {
          user: ownerB,
        })
      ).status,
    ).toBe(403)
  })

  it('P1#4: cannot revoke invite of another organization', async () => {
    const invB = await inviteService.create({ userId: ownerB }, { organizationId: orgB })
    const r = await request('POST', `/api/organizations/${orgA}/invites/${invB.id}/revoke`, {
      user: ownerA,
    })
    expect(r.status).toBe(404)
    const [row] = await db.select().from(inviteLinks).where(eq(inviteLinks.id, invB.id))
    expect(row!.isRevoked).toBe(false)
  })

  it('P1#6: organizer cannot invite organizers', async () => {
    const r = await request('POST', `/api/organizations/${orgA}/invites`, {
      user: organizerA,
      body: { roleToAssign: 'organizer' },
    })
    expect(r.status).toBe(403)
  })

  it('P1#7: pending member cannot see members or events', async () => {
    expect(
      (await request('GET', `/api/organizations/${orgA}/members`, { user: pendingA })).status,
    ).toBe(403)
    expect(
      (await request('GET', `/api/organizations/${orgA}/events`, { user: pendingA })).status,
    ).toBe(403)
    expect((await request('GET', `/api/organizations/${orgA}`, { user: pendingA })).status).toBe(
      200,
    )
  })

  it('cross-org: owner B cannot read org A', async () => {
    expect(
      (await request('GET', `/api/organizations/${orgA}/members`, { user: ownerB })).status,
    ).toBe(403)
  })

  it('player cannot list pending applications', async () => {
    const r = await request('GET', `/api/organizations/${orgA}/members?statuses=pending`, {
      user: playerA,
    })
    expect(r.status).toBe(403)
  })

  it('P2#11: invalid input → 422 without SQL', async () => {
    const r1 = await request('POST', '/api/organizations', { user: ownerA, body: { name: 'x' } })
    expect(r1.status).toBe(422)
    const r2 = await request('GET', `/api/organizations/${orgA}/members?statuses=foo`, {
      user: ownerA,
    })
    expect(r2.status).toBe(422)
    expect(r2.text.toLowerCase()).not.toContain('select')
  })

  it('P2#12: query-string does not break tenant', async () => {
    const r = await request('GET', `/api/organizations/${orgA}?tab=1`, { user: ownerA })
    expect(r.status).toBe(200)
    expect((r.body as { organization?: { id: number } }).organization?.id).toBe(orgA)
  })

  it('4.9.17: invite preview — context, reason, my membership', async () => {
    const inv = await inviteService.create({ userId: ownerA }, { organizationId: orgA, maxUses: 1 })
    const outsider = await newUser('outsider')
    const r = await request('GET', `/api/invites/${inv.token}`, { user: outsider })
    const body = r.body as {
      status: string
      organization: { membersCount: number; avatars: unknown[] }
      inviter: { name: string; role: string }
      myMembership: unknown
    }
    expect(body.status).toBe('valid')
    expect(body.organization.membersCount).toBe(3)
    expect(body.inviter).toMatchObject({ name: 'ownerA', role: 'owner' })
    expect(body.myMembership).toBeNull()
    expect(r.text).not.toContain('@t.by')

    await request('POST', `/api/invites/${inv.token}/redeem`, { user: outsider })
    const again = await request('GET', `/api/invites/${inv.token}`, { user: outsider })
    expect((again.body as { myMembership: { status: string } }).myMembership.status).toBe('active')

    const other = await newUser('late')
    const exhausted = await request('GET', `/api/invites/${inv.token}`, { user: other })
    expect((exhausted.body as { status: string }).status).toBe('exhausted')
    expect((await request('GET', '/api/invites/nope1234', { user: other })).body).toMatchObject({
      status: 'not_found',
    })
  })

  it('8.8.10: internal invite preview requires the shared secret', async () => {
    const inv = await inviteService.create({ userId: ownerA }, { organizationId: orgA })
    const anon = await request('GET', `/api/internal/invites/${inv.token}/preview`)
    expect(anon.status).toBe(401)
  })

  it('9.10.4: smoke cleanup marks the account and drops its sessions', async () => {
    const anon = await request('POST', '/api/internal/smoke/cleanup', {
      body: { telegramUserId: '900000001' },
    })
    expect(anon.status).toBe(401)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
