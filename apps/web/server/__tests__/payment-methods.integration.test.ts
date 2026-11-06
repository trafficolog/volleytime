import { memberService, organizationService } from '@volley-time/core'
import { auditLog, closeDb, db, eq, organizations, users } from '@volley-time/db'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

interface Method {
  method: string
  enabled: boolean
  bank: string | null
  cardLast4: string | null
  recipient: string | null
}

const FULL_CARD = '4111111111111111'

/** Task 21.2.11: GET/PATCH /api/organizations/{orgId}/payment-methods (права, IDOR, реквизиты). */
describe('payment methods API (HTTP integration)', () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let organizerId: number
  let playerId: number
  let outsiderId: number
  let otherOwnerId: number
  let orgId: number
  let otherOrgId: number
  const list = (id = orgId) => `/api/organizations/${id}/payment-methods`
  const one = (method: string, id = orgId) => `${list(id)}/${method}`
  const methodsOf = (body: unknown) => (body as { methods: Method[] }).methods

  async function newUser(tag: string) {
    const [u] = await db
      .insert(users)
      .values({ email: `pm-${tag}-${Math.random()}@t.by` })
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
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Pay HTTP' })).id
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

  it('GET: a group without settings offers both methods without requisites', async () => {
    for (const user of [ownerId, organizerId, playerId]) {
      const res = await request('GET', list(), { user })
      expect(res.status).toBe(200)
      expect(methodsOf(res.body)).toEqual([
        { method: 'cash', enabled: true, bank: null, cardLast4: null, recipient: null },
        { method: 'transfer', enabled: true, bank: null, cardLast4: null, recipient: null },
      ])
    }
  })

  it('PATCH: owner and organizer save requisites; the player sees them, not a disabled method', async () => {
    const saved = await request('PATCH', one('transfer'), {
      user: organizerId,
      body: { bank: 'Belarusbank', cardLast4: '3214', recipient: 'Иван П.' },
    })
    expect(saved.status).toBe(200)
    expect(saved.body).toEqual({
      method: {
        method: 'transfer',
        enabled: true,
        bank: 'Belarusbank',
        cardLast4: '3214',
        recipient: 'Иван П.',
      },
    })
    const asPlayer = await request('GET', list(), { user: playerId })
    expect(methodsOf(asPlayer.body).find((m) => m.method === 'transfer')).toMatchObject({
      bank: 'Belarusbank',
      cardLast4: '3214',
      recipient: 'Иван П.',
    })

    expect(
      (await request('PATCH', one('cash'), { user: ownerId, body: { enabled: false } })).status,
    ).toBe(200)
    const afterOff = await request('GET', list(), { user: playerId })
    expect(methodsOf(afterOff.body).map((m) => m.method)).toEqual(['transfer'])
    const manager = await request('GET', list(), { user: organizerId })
    expect(methodsOf(manager.body)).toHaveLength(2)

    await request('PATCH', one('transfer'), { user: ownerId, body: { enabled: false } })
    expect(methodsOf((await request('GET', list(), { user: playerId })).body)).toEqual([])
  })

  it('PATCH: the player and a non-member are denied and nothing changes', async () => {
    for (const user of [playerId, outsiderId]) {
      const res = await request('PATCH', one('transfer'), { user, body: { bank: 'Hacked' } })
      expect(res.status).toBe(403)
    }
    const res = await request('GET', list(), { user: ownerId })
    expect(methodsOf(res.body).find((m) => m.method === 'transfer')?.bank).toBeNull()
  })

  it('GET: a non-member and an anonymous caller are denied', async () => {
    expect((await request('GET', list(), { user: outsiderId })).status).toBe(403)
    expect((await request('GET', list())).status).toBe(401)
  })

  it('IDOR: requisites of another group are never readable or writable through this group', async () => {
    await request('PATCH', one('transfer', otherOrgId), {
      user: otherOwnerId,
      body: { bank: 'Секретбанк', cardLast4: '9999' },
    })
    // владелец группы A читает и пишет только свою
    const read = await request('GET', list(), { user: ownerId })
    expect(JSON.stringify(read.body)).not.toContain('Секретбанк')
    const foreignRead = await request('GET', list(otherOrgId), { user: ownerId })
    expect(foreignRead.status).toBe(403)
    expect(JSON.stringify(foreignRead.body)).not.toContain('Секретбанк')
    const foreignWrite = await request('PATCH', one('transfer', otherOrgId), {
      user: ownerId,
      body: { bank: 'Hacked' },
    })
    expect(foreignWrite.status).toBe(403)
    const own = await request('GET', list(otherOrgId), { user: otherOwnerId })
    expect(methodsOf(own.body).find((m) => m.method === 'transfer')?.bank).toBe('Секретбанк')
  })

  it('PATCH validation: card tail, full numbers, unknown keys and methods, cash requisites', async () => {
    const cases: [string, unknown][] = [
      ['transfer', { cardLast4: '123' }],
      ['transfer', { cardLast4: FULL_CARD }],
      ['transfer', { bank: '4111 1111 1111 1111' }],
      ['transfer', { recipient: FULL_CARD }],
      ['transfer', { cardNumber: FULL_CARD }],
      ['transfer', { bank: 'x'.repeat(101) }],
      ['transfer', {}],
      ['cash', { bank: 'Belarusbank' }],
      ['transfer', { enabled: 'yes' }],
    ]
    for (const [method, body] of cases) {
      const res = await request('PATCH', one(method), { user: ownerId, body })
      expect(res.status, JSON.stringify(body)).toBe(422)
      // ошибка не повторяет введённый номер
      expect(res.text).not.toContain(FULL_CARD)
      expect(res.text).not.toContain('4111')
    }
    expect(
      (await request('PATCH', one('online'), { user: ownerId, body: { enabled: true } })).status,
    ).toBe(404)
    expect(
      (await request('PATCH', one('erip'), { user: ownerId, body: { enabled: true } })).status,
    ).toBe(404)
    expect(methodsOf((await request('GET', list(), { user: ownerId })).body)).toEqual([
      { method: 'cash', enabled: true, bank: null, cardLast4: null, recipient: null },
      { method: 'transfer', enabled: true, bank: null, cardLast4: null, recipient: null },
    ])
  })

  it('PATCH: an archived group answers 410', async () => {
    await db.update(organizations).set({ status: 'archived' }).where(eq(organizations.id, orgId))
    const res = await request('PATCH', one('cash'), { user: ownerId, body: { enabled: false } })
    expect(res.status).toBe(410)
  })

  it('audit: the change is recorded with the author and no full card number reaches logs or responses', async () => {
    const logs = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
    ]
    try {
      await request('PATCH', one('transfer'), {
        user: organizerId,
        body: { bank: 'Belarusbank', cardLast4: '3214', recipient: 'Иван П.' },
      })
      const rejected = await request('PATCH', one('transfer'), {
        user: organizerId,
        body: { bank: FULL_CARD, cardLast4: FULL_CARD },
      })
      expect(rejected.status).toBe(422)

      const entries = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, 'organization.payment_method_updated'))
      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({ userId: organizerId, organizationId: orgId })
      expect(entries[0]!.newValue).toMatchObject({ method: 'transfer', cardLast4: '3214' })

      const audit = await request('GET', `/api/organizations/${orgId}/audit`, { user: ownerId })
      expect(audit.status).toBe(200)
      const everything = JSON.stringify([
        rejected.text,
        audit.text,
        entries,
        logs.map((l) => l.mock.calls),
      ])
      expect(everything).not.toContain(FULL_CARD)
      expect(everything).not.toContain('4111')
    } finally {
      for (const l of logs) l.mockRestore()
    }
  })
})
