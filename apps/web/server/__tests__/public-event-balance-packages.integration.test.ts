import { closeDb, db, eq, eventBalancePackages } from '@volley-time/db'
import { resetEventBalancePackages } from '@volley-time/db/test-utils'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

type Api = Awaited<ReturnType<typeof createTestApi>>

const URL = '/api/public/event-balance-packages'

/** Task 24.1.4: публичный каталог пакетов баланса событий для блока тарифов лендинга (D-11, D-18). */
describe('GET /api/public/event-balance-packages (24.1.4)', { timeout: 60_000 }, () => {
  let request: Api

  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(resetEventBalancePackages)
  afterAll(async () => {
    await resetEventBalancePackages()
    await closeDb()
  })

  it('serves the visible catalog without a session, in catalog order, with the catalog badge', async () => {
    const res = await request('GET', URL)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      packages: [
        { code: 'events_10', units: 10, amount: 5000, currency: 'BYN', badge: null },
        { code: 'events_30', units: 30, amount: 12000, currency: 'BYN', badge: 'popular' },
        { code: 'events_100', units: 100, amount: 35000, currency: 'BYN', badge: 'discount' },
      ],
    })
    expect(res.headers.get('cache-control')).toContain('public')
  })

  it('hides hidden and archived packages and follows the price Root Admin sets', async () => {
    await db
      .update(eventBalancePackages)
      .set({ visible: false })
      .where(eq(eventBalancePackages.code, 'events_10'))
    await db
      .update(eventBalancePackages)
      .set({ visible: false, archivedAt: new Date() })
      .where(eq(eventBalancePackages.code, 'events_100'))
    await db
      .update(eventBalancePackages)
      .set({ amount: 11000 })
      .where(eq(eventBalancePackages.code, 'events_30'))
    const res = await request('GET', URL)
    expect((res.body as { packages: { code: string; amount: number }[] }).packages).toEqual([
      expect.objectContaining({ code: 'events_30', amount: 11000 }),
    ])
  })

  it('exposes only catalog fields: no ids, versions, sales or audit data', async () => {
    const res = await request('GET', URL)
    const keys = (res.body as { packages: object[] }).packages.map((p) => Object.keys(p).sort())
    for (const k of keys) expect(k).toEqual(['amount', 'badge', 'code', 'currency', 'units'])
  })
})
