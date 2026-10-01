import {
  bookings,
  closeDb,
  db,
  eq,
  organizations,
  organizationMembers,
  payments,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventPricingService } from '../events/pricing-service'
import { eventService } from '../events/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { createNotificationCollector, dispatchNotifications } from './collect'
import { setNotifierTransport } from './service'
import type { NotifyPayload, PendingNotification } from './types'

describe('split notifications after commit (PostgreSQL)', () => {
  let ownerId: number
  let playerIds: number[]
  let orgId: number
  let eventId: number
  let sent: NotifyPayload[]
  let request: (
    method: string,
    url: string,
    opts: { user?: number },
  ) => Promise<{ status: number; body: unknown }>
  let withNotifications: <T>(fn: (notifications: PendingNotification[]) => Promise<T>) => Promise<T>
  const owner = () => ({ userId: ownerId })
  const reserve = async (notifications?: ReturnType<typeof createNotificationCollector>) => {
    const result = []
    for (const [i, userId] of playerIds.slice(0, 3).entries())
      result.push(
        await bookingService.book({ userId, notifications }, orgId, eventId, {
          method: i === 1 ? 'transfer' : 'cash',
        }),
      )
    return result
  }

  beforeAll(async () => {
    // These integration boundaries belong to web, outside core's compiler rootDir.
    // Load the real wrapper and HTTP harness at runtime, as the harness loads API routes.
    const harnessUrl = new URL('../../../../apps/web/server/__tests__/harness.ts', import.meta.url)
      .href
    const notifyUrl = new URL('../../../../apps/web/server/utils/notify.ts', import.meta.url).href
    const harness = await import(harnessUrl)
    withNotifications = (await import(notifyUrl)).withNotifications
    request = await harness.createTestApi()
  })
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    sent = []
    setNotifierTransport({
      async send(payload) {
        sent.push(payload)
      },
    })
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    vi.stubEnv('WEB_URL', 'https://volleytime.by')
    vi.stubEnv('NUXT_PUBLIC_WEB_URL', '')
    const people = await db
      .insert(users)
      .values(
        Array.from({ length: 6 }, (_, i) => ({
          email: `split-notify-${i}@test.by`,
          telegramUserId: BigInt(8100 + i),
        })),
      )
      .returning()
    ownerId = people[0]!.id
    playerIds = people.slice(1).map((p) => p.id)
    orgId = (await organizationService.create(owner(), { name: 'Split notifications' })).id
    await db.insert(organizationMembers).values(
      playerIds.map((userId) => ({
        userId,
        organizationId: orgId,
        role: 'player' as const,
        status: 'active' as const,
      })),
    )
    eventId = (
      await eventService.create(owner(), orgId, {
        title: '<Игра> & команда',
        startsAt: new Date('2030-10-02T16:00:00Z'),
        endsAt: new Date('2030-10-02T18:00:00Z'),
        capacity: 3,
        priceMode: 'split',
        targetAmount: 10000,
      })
    ).id
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    setNotifierTransport({ async send() {} })
  })
  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  it('split_reservation_is_not_free_or_payment_request, including promotion and rebooking', async () => {
    const notifications = createNotificationCollector()
    const reserved = await reserve(notifications)
    expect(notifications.map((n) => n.type)).toEqual([
      'split_booking_reserved',
      'split_booking_reserved',
      'split_booking_reserved',
    ])
    expect(sent).toEqual([])
    notifications.length = 0
    await bookingService.book({ userId: playerIds[3]!, notifications }, orgId, eventId, {
      method: 'transfer',
    })
    expect(notifications[0]?.type).toBe('booking_waitlisted')
    notifications.length = 0
    await bookingService.cancel({ userId: playerIds[0]!, notifications }, reserved[0]!.id)
    expect(notifications).toMatchObject([{ userId: playerIds[3], type: 'split_booking_reserved' }])
    await dispatchNotifications(notifications)
    expect(sent[0]?.text).toContain('Точная сумма после закрытия записи')
    expect(sent[0]?.text).not.toMatch(/Бесплатно|оплатите|BYN/i)
    await bookingService.cancel({ userId: playerIds[1]! }, reserved[1]!.id)
    notifications.length = 0
    await bookingService.book({ userId: playerIds[0]!, notifications }, orgId, eventId, {
      method: 'cash',
    })
    expect(notifications).toMatchObject([{ userId: playerIds[0], type: 'split_booking_reserved' }])
  })

  it('dispatches_once_after_commit with 3334/3333/3333 and one manager summary', async () => {
    const cancelled = await bookingService.book({ userId: playerIds[4]! }, orgId, eventId, {
      method: 'cash',
    })
    await bookingService.cancel({ userId: playerIds[4]! }, cancelled.id)
    await reserve()
    await bookingService.book({ userId: playerIds[3]! }, orgId, eventId, { method: 'cash' })
    const notifications = createNotificationCollector()
    await eventPricingService.settle({ ...owner(), notifications }, orgId, eventId)
    expect(sent).toEqual([])
    expect(notifications).toMatchObject([
      {
        userId: playerIds[0],
        type: 'split_price_settled',
        params: { amount: 3334, method: 'cash' },
      },
      {
        userId: playerIds[1],
        type: 'split_price_settled',
        params: { amount: 3333, method: 'transfer' },
      },
      {
        userId: playerIds[2],
        type: 'split_price_settled',
        params: { amount: 3333, method: 'cash' },
      },
      {
        userId: ownerId,
        type: 'split_settled_organizer',
        params: { targetAmount: 10000, participantCount: 3 },
      },
    ])
    expect(await dispatchNotifications(notifications)).toBe(4)
    expect(sent.map((p) => p.telegramId).sort()).toEqual(['8100', '8101', '8102', '8103'])
    expect(sent.find((p) => p.telegramId === '8101')?.text).toContain('33,34 BYN')
    expect(sent.find((p) => p.telegramId === '8102')?.text).toContain('33,33 BYN переводом')
    expect(sent.every((p) => p.text.includes('&lt;Игра&gt; &amp; команда'))).toBe(true)
    expect(sent.every((p) => p.text.includes('19:00'))).toBe(true)
    expect(
      sent.every(
        (p) =>
          p.keyboard?.[0]?.[0]?.webAppUrl === `https://volleytime.by/m/?startapp=event_${eventId}`,
      ),
    ).toBe(true)
    const allocated = await db.query.bookings.findMany({
      where: eq(bookings.eventId, eventId),
      orderBy: bookings.id,
    })
    const paymentNotifications = createNotificationCollector()
    await paymentService.confirm(
      { ...owner(), notifications: paymentNotifications },
      allocated[1]!.paymentId!,
    )
    await paymentService.cancel(
      { ...owner(), notifications: paymentNotifications },
      allocated[2]!.paymentId!,
    )
    expect(paymentNotifications.map((n) => n.type)).toEqual([
      'payment_confirmed',
      'payment_rejected',
    ])
    const repeated = createNotificationCollector()
    await eventPricingService.settle({ ...owner(), notifications: repeated }, orgId, eventId)
    expect(repeated).toEqual([])
    expect(await dispatchNotifications(repeated)).toBe(0)
    expect(sent).toHaveLength(4)
  })

  it('rollback dispatches zero notifications and leaves no payments or allocations', async () => {
    await reserve()
    await expect(
      withNotifications((notifications) =>
        db.transaction(async (tx) => {
          await eventPricingService.settle({ ...owner(), db: tx, notifications }, orgId, eventId)
          throw new Error('force outer rollback')
        }),
      ),
    ).rejects.toThrow('force outer rollback')
    expect(sent).toEqual([])
    expect(await db.select().from(payments)).toEqual([])
    expect(
      (await db.select().from(bookings)).every(
        (b) => b.paymentId === null && b.allocatedAmount === null,
      ),
    ).toBe(true)
    expect(await eventService.getById(owner(), eventId)).toMatchObject({
      status: 'published',
      pricingSettledAt: null,
    })
  })

  it('transport_failure_keeps_committed_settlement and its GET result', async () => {
    await reserve()
    const committedAtSend: string[] = []
    setNotifierTransport({
      async send() {
        const event = await eventService.getById(owner(), eventId)
        committedAtSend.push(event.status)
        throw new Error('Telegram unavailable')
      },
    })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await withNotifications((notifications) =>
      eventPricingService.settle({ ...owner(), notifications }, orgId, eventId),
    )
    await vi.waitFor(() => expect(committedAtSend).toHaveLength(4))
    await vi.waitFor(() => expect(logged).toHaveBeenCalledTimes(4))
    expect(committedAtSend).toEqual(['closed', 'closed', 'closed', 'closed'])
    expect(await db.select().from(payments)).toHaveLength(3)
    expect(
      (await db.query.bookings.findMany({ orderBy: bookings.id })).map((b) => b.allocatedAmount),
    ).toEqual([3334, 3333, 3333])
    expect(result.summary).toEqual({
      targetAmount: 10000,
      participantCount: 3,
      minAmount: 3333,
      maxAmount: 3334,
    })
    const response = await request('GET', `/api/organizations/${orgId}/events/${eventId}`, {
      user: playerIds[0],
    })
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      event: {
        status: 'closed',
        pricing: { basis: 'settled', myAllocatedAmount: 3334, myPaymentStatus: 'pending' },
      },
    })
  })
})
