import {
  DeliveryError,
  memberService,
  organizationService,
  setNotifierTransport,
  type NotifyPayload,
} from '@volley-time/core'
import {
  auditLog,
  closeDb,
  db,
  eq,
  notifications,
  organizationOwnershipTransfers,
  organizations,
  scheduledJobs,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApi } from './harness'

/**
 * Task 21.4.7 (решение владельца 2026-11-11), HTTP: начало передачи отправляет получателю личную
 * ссылку ботом из того же запроса. Токен — только в сообщении получателю; сбой бота передачу не
 * ломает (владелец видит «бот не доставил»); чужие пользователи и группы ничего не получают.
 */
describe('ownership transfer bot link (HTTP integration)', { timeout: 60_000 }, () => {
  let request: Awaited<ReturnType<typeof createTestApi>>
  let ownerId: number
  let recipientId: number
  let organizerId: number
  let assistantId: number
  let playerId: number
  let foreignOwnerId: number
  let orgId: number
  let recipientMemberId: number
  let foreignMemberId: number
  let sent: NotifyPayload[]
  let failWith: (() => Error) | null
  let logs: string[]
  const TG = { owner: 8001n, recipient: 8002n, organizer: 8003n, player: 8004n, foreign: 8005n }
  const base = () => `/api/organizations/${orgId}/ownership-transfer`

  async function newUser(tag: string, tg: bigint) {
    const [u] = await db
      .insert(users)
      .values({
        email: `own-n-${tag}-${Math.random()}@t.by`,
        name: `Имя ${tag}`,
        telegramUserId: tg,
      })
      .returning()
    return u!.id
  }

  const start = (user: number, member = recipientMemberId, org = orgId) =>
    request('POST', `/api/organizations/${org}/ownership-transfer`, {
      user,
      body: { recipientMemberId: member },
    })

  const everythingStored = async () =>
    JSON.stringify([
      await db.select().from(auditLog),
      await db.select().from(notifications),
      await db.select().from(scheduledJobs),
      await db.select().from(organizationOwnershipTransfers),
    ]) + logs.join('\n')

  beforeAll(async () => {
    request = await createTestApi()
  })

  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    sent = []
    failWith = null
    logs = []
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const)
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => {
        logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
      })
    setNotifierTransport({
      async send(payload) {
        if (failWith) throw failWith()
        sent.push(payload)
      },
    })
    ownerId = await newUser('owner', TG.owner)
    recipientId = await newUser('recipient', TG.recipient)
    organizerId = await newUser('organizer', TG.organizer)
    assistantId = await newUser('assistant', 8006n)
    playerId = await newUser('player', TG.player)
    foreignOwnerId = await newUser('foreign', TG.foreign)
    orgId = (await organizationService.create({ userId: ownerId }, { name: 'Волейбол Минск' })).id
    const add = async (userId: number, role?: string) =>
      (
        await memberService.add(
          { userId: ownerId },
          { organizationId: orgId, userId, ...(role ? { role } : {}) },
        )
      ).id
    recipientMemberId = await add(recipientId)
    await add(organizerId, 'organizer')
    await add(assistantId, 'assistant')
    await add(playerId)
    const foreignOrg = (
      await organizationService.create({ userId: foreignOwnerId }, { name: 'Чужая группа' })
    ).id
    foreignMemberId = (
      await memberService.add(
        { userId: foreignOwnerId },
        { organizationId: foreignOrg, userId: playerId },
      )
    ).id
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setNotifierTransport({ async send() {} })
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('start sends the same personal link to the recipient only, and reports delivery', async () => {
    const res = await start(ownerId)
    expect(res.status, res.text).toBe(200)
    const body = res.body as {
      transfer: { id: number; botDelivery: unknown }
      links: { telegram: string | null; web: string }
      botDelivery: unknown
    }
    expect(body.botDelivery).toEqual({ status: 'delivered' })
    expect(body.transfer.botDelivery).toEqual({ status: 'delivered' })
    const token = body.links.web.split('#')[1]!
    expect(sent).toHaveLength(1)
    expect(sent[0]!.telegramId).toBe(String(TG.recipient))
    expect(sent[0]!.text).toContain('Волейбол Минск')
    expect(sent[0]!.text).toContain(body.links.telegram ?? body.links.web)
    expect(JSON.stringify(sent[0]!.keyboard)).toContain(token)
    // токен нигде не сохранён и не залогирован
    expect(await everythingStored()).not.toContain(token)
    // состояние читается заново
    const current = await request('GET', base(), { user: ownerId })
    expect(current.body).toMatchObject({
      transfer: { id: body.transfer.id, botDelivery: { status: 'delivered' } },
    })
  })

  it('bot down: the transfer is still created and the owner sees "not delivered"', async () => {
    failWith = () => new DeliveryError('blocked')
    const res = await start(ownerId)
    expect(res.status, res.text).toBe(200)
    const body = res.body as {
      transfer: { id: number }
      links: { web: string }
      botDelivery: unknown
    }
    expect(body.botDelivery).toEqual({ status: 'not_delivered', reason: 'blocked' })
    expect(body.links.web).toContain('/app/transfer#')
    expect(sent).toHaveLength(0)
    const current = await request('GET', base(), { user: ownerId })
    expect(current.body).toMatchObject({
      transfer: {
        id: body.transfer.id,
        botDelivery: { status: 'not_delivered', reason: 'blocked' },
      },
    })
    const token = body.links.web.split('#')[1]!
    expect(await everythingStored()).not.toContain(token)
    // запасной путь: ссылка работает, получатель принимает её
    const acc = await request('POST', '/api/ownership-transfers/accept', {
      user: recipientId,
      body: { token },
    })
    expect(acc.status, acc.text).toBe(200)
  })

  it('a recipient without a bot chat does not break the transfer either', async () => {
    await db.update(users).set({ telegramUserId: null }).where(eq(users.id, recipientId))
    const res = await start(ownerId)
    expect(res.status, res.text).toBe(200)
    expect((res.body as { botDelivery: unknown }).botDelivery).toEqual({
      status: 'not_delivered',
      reason: 'no_telegram',
    })
  })

  it('accept and cancel notify only the previous owner', async () => {
    const first = await start(ownerId)
    const token = (first.body as { links: { web: string } }).links.web.split('#')[1]!
    sent.length = 0
    const acc = await request('POST', '/api/ownership-transfers/accept', {
      user: recipientId,
      body: { token },
    })
    expect(acc.status, acc.text).toBe(200)
    expect(sent.map((p) => p.telegramId)).toEqual([String(TG.owner)])
    expect(sent[0]!.text).toContain('Имя recipient')

    sent.length = 0
    // новый owner начинает передачу обратно и отменяет её
    const back = await request('POST', base(), {
      user: recipientId,
      body: { recipientMemberId: await ownerMemberId() },
    })
    expect(back.status, back.text).toBe(200)
    sent.length = 0
    const del = await request('DELETE', base(), { user: recipientId })
    expect(del.status).toBe(200)
    expect(sent.map((p) => p.telegramId)).toEqual([String(TG.recipient)])
  })

  describe('IDOR', () => {
    it.each([
      ['organizer', () => organizerId],
      ['assistant', () => assistantId],
      ['player', () => playerId],
      ['recipient', () => recipientId],
    ])('%s cannot start a transfer and nothing is sent', async (_name, who) => {
      const res = await start(who())
      expect(res.status).toBe(403)
      expect(sent).toHaveLength(0)
      expect(await db.select().from(organizationOwnershipTransfers)).toHaveLength(0)
    })

    it("another group's owner cannot start a transfer in this group; nothing is sent", async () => {
      const res = await start(foreignOwnerId)
      expect([403, 404]).toContain(res.status)
      expect(sent).toHaveLength(0)
      expect(await db.select().from(organizationOwnershipTransfers)).toHaveLength(0)
    })

    it('a member of another group cannot be a recipient: no message is sent to them', async () => {
      const res = await start(ownerId, foreignMemberId)
      expect(res.status).toBe(422)
      expect(sent).toHaveLength(0)
    })

    it('the delivery state is hidden from non-owners and other groups', async () => {
      await start(ownerId)
      for (const who of [organizerId, playerId, recipientId, foreignOwnerId]) {
        const res = await request('GET', base(), { user: who })
        expect([403, 404]).toContain(res.status)
        expect(res.text).not.toContain('botDelivery')
      }
    })
  })

  async function ownerMemberId() {
    const row = await db.query.organizationMembers.findFirst({
      where: (m, { and, eq }) => and(eq(m.organizationId, orgId), eq(m.userId, ownerId)),
    })
    return row!.id
  }
})
