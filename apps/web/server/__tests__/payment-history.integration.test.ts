import { memberService, organizationService } from '@volley-time/core'
import { closeDb, db, organizations, payments, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApi } from './harness'

describe('payment history HTTP (integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let owner: number
  let orgId: number
  beforeAll(async () => {
    request = await createTestApi()
  })
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ name: 'Owner', email: 'private@t.by', phone: '+375', telegramUserId: 321n })
      .returning()
    owner = u!.id
    orgId = (await organizationService.create({ userId: owner }, { name: 'History' })).id
    for (const status of ['pending', 'succeeded', 'cancelled', 'refunded'] as const)
      await db
        .insert(payments)
        .values({ organizationId: orgId, userId: owner, amount: 1000, method: 'cash', status })
  })
  afterAll(() => closeDb())
  const url = () => `/api/organizations/${orgId}/payments/history`

  it('returns all statuses publicly and encodes usable pagination', async () => {
    const first = await request('GET', url() + '?limit=2', { user: owner })
    expect(first.status).toBe(200)
    expect(first.text).not.toMatch(/email|phone|telegramUserId|isRootAdmin|private@|\+375/)
    const body = first.body as { payments: { id: number; status: string }[]; nextCursor: string }
    expect(body.payments).toHaveLength(2)
    expect(typeof body.nextCursor).toBe('string')
    const next = await request('GET', url() + '?limit=2&cursor=' + body.nextCursor, { user: owner })
    expect(next.status).toBe(200)
    const page = next.body as typeof body
    expect([...body.payments, ...page.payments].map((p) => p.status).sort()).toEqual([
      'cancelled',
      'pending',
      'refunded',
      'succeeded',
    ])
    expect(new Set([...body.payments, ...page.payments].map((p) => p.id)).size).toBe(4)
    expect(page.nextCursor).toBeNull()
    const filtered = await request('GET', url() + '?status=cancelled', { user: owner })
    expect((filtered.body as typeof body).payments.map((p) => p.status)).toEqual(['cancelled'])
  })
  it.each(['organizer', 'assistant', 'player'] as const)(
    'enforces %s permissions',
    async (role) => {
      const [user] = await db.insert(users).values({ name: role }).returning()
      await memberService.add({ userId: owner }, { organizationId: orgId, userId: user!.id, role })
      const response = await request('GET', url(), { user: user!.id })
      expect(response.status).toBe(role === 'organizer' ? 200 : 403)
      if (role !== 'organizer') expect(response.text).not.toContain('payments')
    },
  )
  it('does not disclose another organization or allow anonymous access', async () => {
    const [user] = await db.insert(users).values({ name: 'Foreign owner' }).returning()
    const org = await organizationService.create({ userId: user!.id }, { name: 'Foreign' })
    const foreign = await request('GET', url(), { user: user!.id })
    expect([403, 404]).toContain(foreign.status)
    expect(foreign.text).not.toContain('payments')
    const ownEmpty = await request('GET', `/api/organizations/${org.id}/payments/history`, {
      user: user!.id,
    })
    expect(ownEmpty.body).toEqual({ payments: [], nextCursor: null })
    expect((await request('GET', url())).status).toBe(401)
  })
  it.each([
    'status=paid',
    'limit=0',
    'limit=101',
    'cursor=bad',
    'status=pending&status=refunded',
    'limit=1&limit=2',
    'cursor=a&cursor=b',
  ])('returns 400 for %s', async (query) => {
    expect((await request('GET', url() + '?' + query, { user: owner })).status).toBe(400)
  })
  it('leaves the existing pending endpoint unchanged', async () => {
    const response = await request('GET', `/api/organizations/${orgId}/payments`, { user: owner })
    expect(response.status).toBe(200)
    expect(Object.keys(response.body as object)).toEqual(['payments'])
    const rows = (response.body as { payments: object[] }).payments
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0]!).sort()).toEqual([
      'amount',
      'bookingId',
      'createdAt',
      'currency',
      'event',
      'id',
      'method',
      'plan',
      'subscriptionId',
      'user',
    ])
  })
})
