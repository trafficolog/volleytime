import { invalidatePlatformSettingsCache, organizationService } from '@volley-time/core'
import { auditLog, closeDb, db, eq, organizations, platformSettings, users } from '@volley-time/db'
import { resetPlatformSettings } from '@volley-time/db/test-utils'
import { addIsoDays, minskToday, type PlatformSettingsResponse } from '@volley-time/shared'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi, listApiRoutes } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

const SETTINGS = '/api/platform/settings'

/** Task 22.3.1: `/api/platform/settings` и безлимит группы — только для root; внутренний маршрут бота. */
describe('/api/platform/settings (HTTP)', { timeout: 60_000 }, () => {
  let request: Api
  let root: number
  let plain: number
  let orgId: number
  const secret = { 'x-internal-secret': 'dev-internal-secret' }
  const previousFlag = process.env.EVENT_BALANCE_ENFORCED
  const unlimited = (id = orgId) => `/api/platform/organizations/${id}/event-balance/unlimited`

  const get = async () =>
    (await request('GET', SETTINGS, { user: root })).body as PlatformSettingsResponse
  const patch = (changes: unknown[], user = root) =>
    request('PATCH', SETTINGS, { user, body: { changes } })

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    process.env.EVENT_BALANCE_ENFORCED = 'true'
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    await resetPlatformSettings()
    invalidatePlatformSettingsCache()
    ;[root, plain] = (
      await db
        .insert(users)
        .values([
          { name: 'Root', email: 'root@vt.test', isRootAdmin: true },
          { name: 'Plain', email: 'plain@vt.test' },
        ])
        .returning()
    ).map((u) => u.id) as [number, number]
    orgId = (await organizationService.create({ userId: plain }, { name: 'Settings HTTP' })).id
  })
  afterEach(() => {
    if (previousFlag === undefined) delete process.env.EVENT_BALANCE_ENFORCED
    else process.env.EVENT_BALANCE_ENFORCED = previousFlag
  })
  afterAll(async () => {
    await db.delete(auditLog)
    await db.delete(organizations)
    await db.delete(users)
    await resetPlatformSettings()
    await closeDb()
  })

  it('401 without a session, 403 forbidden.root_only for a non-root user, on every route', async () => {
    const routes: [string, string, unknown?][] = [
      ['GET', SETTINGS],
      ['PATCH', SETTINGS, { changes: [{ key: 'bot.callbackLimit', value: 9, version: 0 }] }],
      ['GET', `${SETTINGS}/history`],
      ['PUT', unlimited(), { until: '2099-01-01', reason: 'тест' }],
      ['POST', `${unlimited()}/cancel`, { reason: 'тест' }],
    ]
    for (const [method, url, body] of routes) {
      expect((await request(method, url, { body })).status, `${method} ${url}`).toBe(401)
      const res = await request(method, url, { user: plain, body })
      expect(res.status, `${method} ${url}`).toBe(403)
      expect(res.body).toMatchObject({ data: { code: 'forbidden.root_only' } })
    }
    expect(await db.select().from(platformSettings)).toHaveLength(0)
    expect(await db.$count(auditLog, eq(auditLog.entityType, 'platform_setting'))).toBe(0)
  })

  it('GET returns defaults with version 0, readonly statuses and no cache', async () => {
    const res = await request('GET', SETTINGS, { user: root })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = res.body as PlatformSettingsResponse
    expect(body.applyDelaySeconds).toBe(30)
    expect(body.settings['general.platformName']).toEqual({
      value: 'Volley Time',
      default: 'Volley Time',
      version: 0,
      updatedAt: null,
      updatedBy: null,
    })
    expect(body.readonly.payments).toMatchObject({ currency: 'BYN', onlinePayments: false })
    expect(body.readonly.general.region).toBe('Europe/Minsk')
    expect(body.readonly.featureFlags.map((f) => f.name)).toContain('EVENT_BALANCE_ENFORCED')
  })

  it('PATCH writes, bumps the version, audits, and answers in the GET shape', async () => {
    const res = await patch([
      { key: 'events.maxPublishedPerDay', value: 3, version: 0 },
      { key: 'general.supportContact', value: '  @help_bot  ', version: 0 },
    ])
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = res.body as PlatformSettingsResponse
    expect(body.settings['events.maxPublishedPerDay']).toMatchObject({ value: 3, version: 1 })
    expect(body.settings['general.supportContact'].value).toBe('@help_bot')
    expect(await db.$count(auditLog, eq(auditLog.entityType, 'platform_setting'))).toBe(2)
    const history = await request('GET', `${SETTINGS}/history`, { user: root })
    expect(history.status).toBe(200)
    expect((history.body as { entries: unknown[] }).entries).toHaveLength(2)
  })

  it('409 platform_settings.stale carries the current state; nothing is applied', async () => {
    await patch([{ key: 'bot.callbackLimit', value: 9, version: 0 }])
    const stale = await patch([
      { key: 'bot.callbackWindowSeconds', value: 30, version: 0 },
      { key: 'bot.callbackLimit', value: 20, version: 0 },
    ])
    expect(stale.status).toBe(409)
    const body = stale.body as { data: { code: string; current: PlatformSettingsResponse } }
    expect(body.data.code).toBe('platform_settings.stale')
    expect(body.data.current.settings['bot.callbackLimit'].value).toBe(9)
    expect((await get()).settings['bot.callbackWindowSeconds'].version).toBe(0)
  })

  it('422 for values outside the schema (with the key in the path) and for an unknown key', async () => {
    for (const change of [
      { key: 'bot.callbackLimit', value: 0, version: 0 },
      { key: 'bot.callbackLimit', value: '5', version: 0 },
      { key: 'events.maxPublishedPerDay', value: 51, version: 0 },
      { key: 'eventBalance.newOrganizationGrant', value: 1001, version: 0 },
      { key: 'general.platformName', value: 'a\nb', version: 0 },
    ]) {
      const res = await patch([change])
      expect(res.status, JSON.stringify(change)).toBe(422)
      expect(JSON.stringify(res.body)).toContain(change.key)
    }
    const unknown = await patch([{ key: 'smtp.password', value: 'x', version: 0 }])
    expect(unknown.status).toBe(422)
    expect(unknown.body).toMatchObject({ data: { code: 'platform_settings.unknown_key' } })
    expect((await request('PATCH', SETTINGS, { user: root, body: { changes: [] } })).status).toBe(
      422,
    )
    expect(await db.select().from(platformSettings)).toHaveLength(0)
  })

  it('PUT unlimited sets the date, repeats without new audit, cancel clears it', async () => {
    const until = addIsoDays(minskToday(), 7)
    const set = await request('PUT', unlimited(), { user: root, body: { until, reason: 'Пилот' } })
    expect(set.status).toBe(200)
    expect(set.headers.get('cache-control')).toBe('no-store')
    expect(set.body).toEqual({ until, active: true })
    await request('PUT', unlimited(), { user: root, body: { until, reason: 'Повтор' } })
    expect(await db.$count(auditLog, eq(auditLog.action, 'event_balance.unlimited_set'))).toBe(1)
    const cancel = await request('POST', `${unlimited()}/cancel`, {
      user: root,
      body: { reason: 'Закончили' },
    })
    expect(cancel.body).toEqual({ until: null, active: false })
    expect(
      await db.$count(auditLog, eq(auditLog.action, 'event_balance.unlimited_cancelled')),
    ).toBe(1)
  })

  it('PUT unlimited: 422 for a date out of range or a bad body, 404 for a bad id and group', async () => {
    const today = minskToday()
    for (const body of [
      { until: addIsoDays(today, -1), reason: 'вчера' },
      { until: addIsoDays(today, 367), reason: 'далеко' },
      { until: today },
      { until: today, reason: 'ab' },
    ]) {
      expect((await request('PUT', unlimited(), { user: root, body })).status).toBe(422)
    }
    expect((await request('PUT', unlimited(0), { user: root, body: {} })).status).toBe(404)
    expect(
      (
        await request('PUT', unlimited(999_999), {
          user: root,
          body: { until: today, reason: 'нет' },
        })
      ).status,
    ).toBe(404)
  })

  it('PUT unlimited: 409 organization.deleted for a soft-deleted group', async () => {
    await db
      .update(organizations)
      .set({ deletedAt: new Date(), restoreUntil: new Date(Date.now() + 86_400_000) })
      .where(eq(organizations.id, orgId))
    const res = await request('PUT', unlimited(), {
      user: root,
      body: { until: minskToday(), reason: 'удалённая' },
    })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ data: { code: 'organization.deleted' } })
  })

  it('the cabinet balance shows unlimited; the daily limit answers 409 with date and limit', async () => {
    await request('PUT', unlimited(), {
      user: root,
      body: { until: minskToday(), reason: 'Пилот' },
    })
    const view = await request('GET', `/api/organizations/${orgId}/event-balance`, { user: plain })
    expect((view.body as { eventBalance: { unlimited: unknown } }).eventBalance.unlimited).toEqual({
      until: minskToday(),
    })

    await patch([{ key: 'events.maxPublishedPerDay', value: 1, version: 0 }])
    const mk = (startsAt: string, endsAt: string) => ({
      title: 'Игра дня',
      startsAt,
      endsAt,
      capacity: 10,
      price: 0,
    })
    const url = `/api/organizations/${orgId}/events`
    const first = await request('POST', url, {
      user: plain,
      body: mk('2040-06-10T08:00:00Z', '2040-06-10T09:00:00Z'),
    })
    expect(first.status).toBe(200)
    const second = await request('POST', url, {
      user: plain,
      body: mk('2040-06-10T12:00:00Z', '2040-06-10T13:00:00Z'),
    })
    expect(second.status).toBe(409)
    expect(second.body).toMatchObject({
      data: { code: 'event.daily_limit_reached', date: '2040-06-10', limit: 1 },
    })
  })

  describe('internal bot route', () => {
    it('401 without or with a wrong secret', async () => {
      expect((await request('GET', '/api/internal/bot/settings')).status).toBe(401)
      expect(
        (
          await request('GET', '/api/internal/bot/settings', {
            headers: { 'x-internal-secret': 'no' },
          })
        ).status,
      ).toBe(401)
    })

    it('returns only bot.* keys, defaults first and the saved values after a change', async () => {
      const first = await request('GET', '/api/internal/bot/settings', { headers: secret })
      expect(first.status).toBe(200)
      expect(first.body).toEqual({
        settings: { 'bot.callbackLimit': 8, 'bot.callbackWindowSeconds': 10 },
      })
      await patch([
        { key: 'bot.callbackLimit', value: 3, version: 0 },
        { key: 'general.supportContact', value: 'не для бота', version: 0 },
      ])
      const next = await request('GET', '/api/internal/bot/settings', { headers: secret })
      expect(next.body).toEqual({
        settings: { 'bot.callbackLimit': 3, 'bot.callbackWindowSeconds': 10 },
      })
      expect(JSON.stringify(next.body)).not.toContain('не для бота')
    })
  })

  it('exposes exactly the documented settings and unlimited routes', async () => {
    const routes = (await listApiRoutes())
      .filter(
        (r) =>
          r.route.startsWith('/api/platform/settings') ||
          r.route.includes('/event-balance/unlimited') ||
          r.route === '/api/internal/bot/settings',
      )
      .map((r) => `${r.method} ${r.route}`)
      .sort()
    expect(routes).toEqual(
      [
        'get /api/platform/settings',
        'patch /api/platform/settings',
        'get /api/platform/settings/history',
        'put /api/platform/organizations/:id/event-balance/unlimited',
        'post /api/platform/organizations/:id/event-balance/unlimited/cancel',
        'get /api/internal/bot/settings',
      ].sort(),
    )
  })
})
