import { createHmac } from 'node:crypto'

import {
  bookingService,
  createNotificationCollector,
  dispatchNotifications,
  eventService,
  memberService,
  organizationService,
  paymentService,
  setNotifierTransport,
  type NotifyPayload,
} from '@volley-time/core'
import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { auth as betterAuth } from './config'
import { authenticateViaTelegram } from './telegram/authenticate'

const BOT_TOKEN = '123456:PHASE8'
let sent: NotifyPayload[] = []
let ownerId: number
let orgId: number

const future = (h = 24) => new Date(Date.now() + h * 3600_000)

function signInitData(tgId: number, name = 'Игрок'): string {
  const params: Record<string, string> = {
    user: JSON.stringify({ id: tgId, first_name: name, username: `u${tgId}` }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  }
  const dcs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  const hash = createHmac('sha256', secret).update(dcs).digest('hex')
  const sp = new URLSearchParams(params)
  sp.set('hash', hash)
  return sp.toString()
}

describe('Phase 8 — Telegram end-to-end flows (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    sent = []
    setNotifierTransport({
      async send(p) {
        sent.push(p)
      },
    })
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'TG Club' })
    orgId = org.id
  })

  it('FULL: Telegram auth → session → book → notification delivered', async () => {
    // 1. игрок открывает Mini App: initData -> user + session
    const auth = await authenticateViaTelegram(signInitData(9001), BOT_TOKEN)
    expect(auth.isNewUser).toBe(true)
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
    const res = await betterAuth.handler(
      new Request('http://localhost:3000/api/auth/sign-in/telegram', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ initData: signInitData(9001) }),
      }),
    )
    expect(res.status).toBe(200)
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
    const session = await betterAuth.api.getSession({ headers: new Headers({ cookie }) })
    expect(Number(session?.user.id)).toBe(auth.userId)

    // 2. вступает в организацию и записывается
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: auth.userId })
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Тренировка',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 0,
    })
    const notifications = createNotificationCollector()
    await bookingService.book({ userId: auth.userId, notifications }, orgId, ev.id, {
      method: 'free',
    })

    // 3. уведомление доставлено в Telegram
    await dispatchNotifications(notifications)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.telegramId).toBe('9001')
    expect(sent[0]?.text).toContain('Тренировка')
  })

  it('FULL: payment confirmed → player notified with amount', async () => {
    const auth = await authenticateViaTelegram(signInitData(9002), BOT_TOKEN)
    await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: auth.userId })
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Платная',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 1500,
    })
    const b = await bookingService.book({ userId: auth.userId }, orgId, ev.id, { method: 'cash' })

    const notifications = createNotificationCollector()
    await paymentService.confirm({ userId: ownerId, notifications }, b.paymentId!)
    await dispatchNotifications(notifications)

    expect(sent.some((s) => s.telegramId === '9002' && s.text.includes('15,00 BYN'))).toBe(true)
  })

  it('FULL: event cancelled → all Telegram users notified', async () => {
    const a = await authenticateViaTelegram(signInitData(9003), BOT_TOKEN)
    const b = await authenticateViaTelegram(signInitData(9004), BOT_TOKEN)
    for (const u of [a, b]) {
      await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u.userId })
    }
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Отменяемая',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 0,
    })
    await bookingService.book({ userId: a.userId }, orgId, ev.id, { method: 'free' })
    await bookingService.book({ userId: b.userId }, orgId, ev.id, { method: 'free' })

    const notifications = createNotificationCollector()
    await eventService.cancel({ userId: ownerId, notifications }, ev.id)
    await dispatchNotifications(notifications)

    const ids = sent.map((s) => s.telegramId)
    expect(ids).toContain('9003')
    expect(ids).toContain('9004')
  })

  it('repeat Telegram auth reuses same user (no duplicates)', async () => {
    const first = await authenticateViaTelegram(signInitData(9005), BOT_TOKEN)
    const second = await authenticateViaTelegram(signInitData(9005), BOT_TOKEN)
    expect(second.isNewUser).toBe(false)
    expect(second.userId).toBe(first.userId)
  })

  it('SECURITY: forged initData rejected (no user created)', async () => {
    await expect(authenticateViaTelegram(signInitData(9006), 'WRONG:TOKEN')).rejects.toThrow()
    const found = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.telegramUserId, 9006n),
    })
    expect(found).toBeUndefined()
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
