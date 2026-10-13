import { memberService, organizationService } from '@volley-time/core'
import { closeDb, db, eq, events, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

const DEFAULTS = {
  subscriptionsEnabled: true,
  maxSeatsPerBooking: 3,
  defaultPriceMode: 'fixed',
  defaultJoinMode: 'open',
  cancellationAllowed: true,
  cancellationDeadlineHours: null,
  seoIndex: false,
  district: null,
}

/** Task 19.2.2: GET/PATCH /api/organizations/{orgId}/settings (HTTP, права, IDOR, снимок). */
describe('group settings API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let playerId: number
  let outsiderId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  const url = (id = orgId) => `/api/organizations/${id}/settings`

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `gs-${tag}-${Math.random()}@t.by` })
      .returning()
    return u!.id
  }

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    ownerId = await newUser('owner')
    organizerId = await newUser('organizer')
    playerId = await newUser('player')
    outsiderId = await newUser('outsider')
    otherOwnerId = await newUser('other-owner')
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Settings HTTP' })).id
    otherOrgId = (await organizationService.create({ userId: otherOwnerId }, { name: 'Other' })).id
    await memberService.add(
      { userId: ownerId },
      { organizationId: orgId, userId: organizerId, role: 'organizer' },
    )
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: playerId })
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('permissions', () => {
    it('GET: owner and organizer read the settings', async () => {
      for (const user of [ownerId, organizerId]) {
        const res = await request('GET', url(), { user })
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ settings: expect.objectContaining(DEFAULTS) })
      }
    })

    it('GET: a player and an unauthenticated caller are refused', async () => {
      const player = await request('GET', url(), { user: playerId })
      expect(player.status).toBe(403)
      expect(player.body).toMatchObject({ data: { code: 'forbidden.manage_content' } })
      expect((await request('GET', url())).status).toBe(401)
    })

    it('PATCH: owner only; organizer and player are refused without changes', async () => {
      for (const user of [organizerId, playerId]) {
        const res = await request('PATCH', url(), { user, body: { maxSeatsPerBooking: 9 } })
        expect(res.status).toBe(403)
        expect(res.body).toMatchObject({ data: { code: 'forbidden.owner_only' } })
      }
      expect((await request('PATCH', url(), { body: { seoIndex: true } })).status).toBe(401)
      const res = await request('GET', url(), { user: ownerId })
      expect(res.body).toMatchObject({ settings: { maxSeatsPerBooking: 3, seoIndex: false } })
    })
  })

  describe('IDOR', () => {
    it('another group cannot read or change these settings, even as its owner', async () => {
      for (const user of [outsiderId, otherOwnerId]) {
        const get = await request('GET', url(), { user })
        expect(get.status).toBe(403)
        expect(get.body).toMatchObject({ data: { code: 'permission.not_member' } })
        expect(get.text).not.toContain('maxSeatsPerBooking')

        const patch = await request('PATCH', url(), { user, body: { maxSeatsPerBooking: 10 } })
        expect(patch.status).toBe(403)
      }
      const own = await request('GET', url(), { user: ownerId })
      expect(own.body).toMatchObject({ settings: { maxSeatsPerBooking: 3 } })
    })

    it('patching own group never touches a foreign one', async () => {
      const res = await request('PATCH', url(), { user: ownerId, body: { maxSeatsPerBooking: 8 } })
      expect(res.status).toBe(200)
      const other = await request('GET', url(otherOrgId), { user: otherOwnerId })
      expect(other.body).toMatchObject({ settings: { maxSeatsPerBooking: 3 } })
    })

    it('an unknown group is a 404 without settings in the body', async () => {
      const res = await request('GET', url(otherOrgId + 1000), { user: ownerId })
      expect(res.status).toBe(404)
      expect(res.text).not.toContain('maxSeatsPerBooking')
    })

    it('the settings history of a foreign group is not visible in the audit log', async () => {
      await request('PATCH', url(otherOrgId), { user: otherOwnerId, body: { seoIndex: true } })
      const res = await request(
        'GET',
        `/api/organizations/${orgId}/audit?action=organization.settings_updated`,
        { user: ownerId },
      )
      expect(res.status).toBe(200)
      expect(res.text).not.toContain(`"entityId":${otherOrgId}`)
    })
  })

  describe('validation', () => {
    it.each([
      ['maxSeatsPerBooking 0', { maxSeatsPerBooking: 0 }],
      ['maxSeatsPerBooking 11', { maxSeatsPerBooking: 11 }],
      ['negative deadline', { cancellationDeadlineHours: -5 }],
      ['unknown price mode', { defaultPriceMode: 'free' }],
      ['unknown field', { ownerUserId: 1 }],
    ])('422 validation_failed for %s', async (_n, body) => {
      const res = await request('PATCH', url(), { user: ownerId, body })
      expect(res.status).toBe(422)
      expect(res.body).toMatchObject({
        statusCode: 422,
        data: { code: 'validation_failed', issues: expect.any(Array) },
      })
      expect(res.text).not.toContain('ZodError')
    })

    it('422 organization.invalid_settings for an empty patch', async () => {
      const res = await request('PATCH', url(), { user: ownerId, body: {} })
      expect(res.status).toBe(422)
      expect(res.body).toMatchObject({ data: { code: 'organization.invalid_settings' } })
    })

    it('410 for an archived group (tenant middleware)', async () => {
      await organizationService.archive({ userId: ownerId }, orgId)
      const res = await request('PATCH', url(), { user: ownerId, body: { seoIndex: true } })
      expect(res.status).toBe(410)
    })
  })

  describe('behaviour', () => {
    it('PATCH returns the updated settings and the history shows who/when/old/new', async () => {
      const res = await request('PATCH', url(), {
        user: ownerId,
        body: { maxSeatsPerBooking: 5, cancellationDeadlineHours: 12, district: 'Центр' },
      })
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        settings: { maxSeatsPerBooking: 5, cancellationDeadlineHours: 12, district: 'Центр' },
      })

      const history = await request(
        'GET',
        `/api/organizations/${orgId}/audit?action=organization.settings_updated`,
        { user: ownerId },
      )
      expect(history.status).toBe(200)
      expect(history.text).toContain('organization.settings_updated')
      expect(history.text).toContain('"maxSeatsPerBooking":5')
      expect(history.text).toContain('"maxSeatsPerBooking":3')
      expect(history.text).toContain(`"userId":${ownerId}`)
    })

    it('the subscriptions toggle keeps working through both endpoints', async () => {
      await request('PATCH', url(), { user: ownerId, body: { subscriptionsEnabled: false } })
      expect((await request('GET', url(), { user: ownerId })).body).toMatchObject({
        settings: { subscriptionsEnabled: false },
      })
      const legacy = await request('PATCH', `/api/organizations/${orgId}`, {
        user: ownerId,
        body: { subscriptionsEnabled: true },
      })
      expect(legacy.status).toBe(200)
      expect((await request('GET', url(), { user: ownerId })).body).toMatchObject({
        settings: { subscriptionsEnabled: true },
      })
    })

    it('a new event inherits the policy; existing events keep their own values', async () => {
      const payload = (title: string) => ({
        title,
        startsAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
        endsAt: new Date(Date.now() + 26 * 3600_000).toISOString(),
        capacity: 10,
        price: 1000,
      })
      const first = await request('POST', `/api/organizations/${orgId}/events`, {
        user: ownerId,
        body: payload('До изменения'),
      })
      expect(first.status).toBe(200)

      await request('PATCH', url(), {
        user: ownerId,
        body: { cancellationAllowed: false, cancellationDeadlineHours: 24 },
      })

      const second = await request('POST', `/api/organizations/${orgId}/events`, {
        user: ownerId,
        body: payload('После изменения'),
      })
      expect(second.status).toBe(200)

      const rows = await db.select().from(events).where(eq(events.organizationId, orgId))
      const byTitle = Object.fromEntries(rows.map((e) => [e.title, e]))
      expect(byTitle['До изменения']).toMatchObject({
        cancellationAllowed: true,
        cancellationDeadlineHours: null,
      })
      expect(byTitle['После изменения']).toMatchObject({
        cancellationAllowed: false,
        cancellationDeadlineHours: 24,
      })
    })
  })
})
