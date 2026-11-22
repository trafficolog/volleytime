import { organizationService } from '@volley-time/core'
import { closeDb, db, eq, featureEvents, organizations, users } from '@volley-time/db'
import type { FeatureAnalyticsReport } from '@volley-time/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

/**
 * Task 23.1.2 (P-14, D-25): HTTP-контракт приёма событий функций и отчёта Root Admin.
 * Событие пишется только от имени сессии; отчёт — только root, администратор группы получает 403.
 */
describe('feature analytics API (HTTP integration)', { timeout: 60_000 }, () => {
  let request: Api
  let root: number
  let owner: number
  let player: number

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const people = await db
      .insert(users)
      .values([
        { name: 'Root', email: `fa-root-${Math.random()}@t.by`, isRootAdmin: true },
        { name: 'Owner', email: `fa-owner-${Math.random()}@t.by` },
        { name: 'Player', email: `fa-player-${Math.random()}@t.by` },
      ])
      .returning()
    root = people[0]!.id
    owner = people[1]!.id
    player = people[2]!.id
    await organizationService.create({ userId: owner }, { name: 'Feature analytics' })
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('POST /api/me/feature-events', () => {
    it('requires a session', async () => {
      const res = await request('POST', '/api/me/feature-events', {
        body: { feature: 'cal', kind: 'open' },
      })
      expect(res.status).toBe(401)
      expect(await db.select().from(featureEvents)).toHaveLength(0)
    })

    it('records for the session user and dedupes the same day', async () => {
      const send = () =>
        request('POST', '/api/me/feature-events', {
          user: player,
          body: { feature: 'cal', kind: 'open' },
        })
      const first = await send()
      expect(first.status).toBe(200)
      expect(first.body).toEqual({ recorded: true })
      const second = await send()
      expect(second.status).toBe(200)
      expect(second.body).toEqual({ recorded: false })
      const rows = await db.select().from(featureEvents)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ userId: player, feature: 'cal', kind: 'open' })
    })

    it('cannot write an event for another user (IDOR)', async () => {
      const res = await request('POST', '/api/me/feature-events', {
        user: player,
        body: { feature: 'cal', kind: 'open', userId: owner },
      })
      expect(res.status).toBe(422)
      expect(await db.select().from(featureEvents).where(eq(featureEvents.userId, owner))).toEqual(
        [],
      )
    })

    it.each([
      [{ feature: 'booking', kind: 'open' }],
      [{ feature: 'cal', kind: 'click' }],
      [{ feature: 'cal' }],
      [{}],
    ])('422 validation_failed for %j', async (body) => {
      const res = await request('POST', '/api/me/feature-events', { user: player, body })
      expect(res.status).toBe(422)
      expect(res.body).toMatchObject({ data: { code: 'validation_failed' } })
    })
  })

  describe('GET /api/platform/feature-analytics', () => {
    it('401 without a session', async () => {
      expect((await request('GET', '/api/platform/feature-analytics')).status).toBe(401)
    })

    it.each([
      ['group owner (group admin)', () => owner],
      ['player', () => player],
    ])('403 forbidden.root_only for %s', async (_label, who) => {
      const res = await request('GET', '/api/platform/feature-analytics', { user: who() })
      expect(res.status).toBe(403)
      expect(res.body).toMatchObject({ data: { code: 'forbidden.root_only' } })
    })

    it('root gets platform aggregates with small cohorts suppressed', async () => {
      await request('POST', '/api/me/feature-events', {
        user: player,
        body: { feature: 'cal', kind: 'open' },
      })
      const res = await request('GET', '/api/platform/feature-analytics', { user: root })
      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control')).toBe('no-store')
      const body = res.body as FeatureAnalyticsReport
      expect(body.minCohort).toBe(10)
      expect(body.retentionDays).toBe(180)
      expect(body.players).toBeNull()
      expect(body.features).toHaveLength(8)
      expect(body.features[0]).toMatchObject({
        feature: 'cal',
        weeklyActive: { players: null, value: null, suppressed: true },
      })
    })

    it('a revoked root is rejected on the next request', async () => {
      await db.update(users).set({ isRootAdmin: false }).where(eq(users.id, root))
      expect((await request('GET', '/api/platform/feature-analytics', { user: root })).status).toBe(
        403,
      )
    })
  })
})
