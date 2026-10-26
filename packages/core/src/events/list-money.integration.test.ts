import {
  closeDb,
  db,
  eq,
  inArray,
  organizationMembers,
  organizations,
  payments,
  users,
} from '@volley-time/db'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bookingService } from '../bookings/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { quoteSplitShare, readEventListMoney } from './list-money'
import { readEventPriceQuote, readPricingFinancials } from './pricing-read-model'
import { eventPricingService } from './pricing-service'
import { eventService } from './service'

/** Task 20.5.8: суммы «Оплаты» и цена места в списке событий кабинета. */
describe('event list money (20.5.8)', { timeout: 30_000 }, () => {
  let people: number[] = []
  let ownerId: number
  let orgId: number
  let otherOrgId: number
  const owner = () => ({ userId: ownerId })
  const future = (h = 24) => new Date(Date.now() + h * 3600_000)
  const create = (input: Record<string, unknown> = {}) =>
    eventService.create(owner(), orgId, {
      title: 'Список',
      startsAt: future(),
      endsAt: future(26),
      capacity: 4,
      price: 1000,
      ...input,
    })
  const book = (index: number, eventId: number, method: 'cash' | 'free' = 'cash') =>
    bookingService.book({ userId: people[index]! }, orgId, eventId, { method })
  const money = async (...ids: number[]) => {
    const rows = await eventService.list(owner(), orgId, { filter: 'all' }, { includeDrafts: true })
    return readEventListMoney(
      owner(),
      rows.filter((e) => ids.includes(e.id)),
    )
  }

  beforeEach(async () => {
    vi.stubEnv('EVENT_SPLIT_PRICING_ENABLED', 'true')
    people = (
      await db
        .insert(users)
        .values(
          Array.from({ length: 6 }, (_, i) => ({
            email: `list-money-${crypto.randomUUID()}-${i}@test.by`,
          })),
        )
        .returning()
    ).map((p) => p.id)
    ownerId = people[0]!
    orgId = (await organizationService.create(owner(), { name: 'List money' })).id
    otherOrgId = (await organizationService.create({ userId: people[5]! }, { name: 'Other' })).id
    await db.insert(organizationMembers).values(
      people.slice(1, 5).map((userId) => ({
        userId,
        organizationId: orgId,
        role: 'player' as const,
        status: 'active' as const,
      })),
    )
  })
  afterEach(async () => {
    vi.unstubAllEnvs()
    await db.delete(organizations).where(inArray(organizations.id, [orgId, otherOrgId]))
    await db.delete(users).where(inArray(users.id, people))
  })
  afterAll(closeDb)

  it('empty event and event without payments are zero, in the event currency', async () => {
    const empty = await create()
    const free = await create({ price: 0 })
    await book(1, free.id, 'free')
    const totals = await money(empty.id, free.id)
    expect(totals.get(empty.id)).toEqual({ paid: 0, pending: 0, currency: 'BYN' })
    expect(totals.get(free.id)).toEqual({ paid: 0, pending: 0, currency: 'BYN' })
  })

  it('separates paid (succeeded) from pending and ignores cancelled payments', async () => {
    const event = await create()
    const other = await create({ price: 700 })
    const b1 = await book(1, event.id)
    await book(2, event.id)
    const b3 = await book(3, event.id)
    await book(1, other.id)
    await paymentService.confirm(owner(), b1.paymentId!)
    // отмена игроком до оплаты: платёж cancelled, в сумме ожидания его нет
    await bookingService.cancel({ userId: people[3]! }, b3.id)
    const totals = await money(event.id, other.id)
    expect(totals.get(event.id)).toMatchObject({ paid: 1000, pending: 1000 })
    expect(totals.get(other.id)).toMatchObject({ paid: 0, pending: 700 })
    // совпадает с кассой и карточкой события
    expect(await readPricingFinancials(owner(), event.id)).toMatchObject({
      collected: 1000,
      pending: 1000,
    })
  })

  it('a refunded payment leaves the paid sum', async () => {
    const event = await create()
    const b1 = await book(1, event.id)
    await paymentService.confirm(owner(), b1.paymentId!)
    expect((await money(event.id)).get(event.id)).toMatchObject({ paid: 1000 })
    await eventService.cancel(owner(), event.id)
    expect((await money(event.id)).get(event.id)).toMatchObject({ paid: 0, pending: 0 })
  })

  it('does not count payments of another organization or another currency', async () => {
    const event = await create()
    const b1 = await book(1, event.id)
    await paymentService.confirm(owner(), b1.paymentId!)
    const b2 = await book(2, event.id)
    await db.update(payments).set({ currency: 'USD' }).where(eq(payments.id, b2.paymentId!))
    const b3 = await book(3, event.id)
    await db
      .update(payments)
      .set({ organizationId: otherOrgId })
      .where(eq(payments.id, b3.paymentId!))
    expect((await money(event.id)).get(event.id)).toEqual({
      paid: 1000,
      pending: 0,
      currency: 'BYN',
    })
  })

  it('reads a page of events with one aggregated query', async () => {
    const a = await create()
    const b = await create()
    await book(1, a.id)
    await book(1, b.id)
    const totals = await money(a.id, b.id)
    expect([...totals.keys()].sort()).toEqual([a.id, b.id].sort())
    expect(await readEventListMoney(owner(), [])).toEqual(new Map())
  })

  describe('split share', () => {
    const splitEvent = () => create({ priceMode: 'split', price: 0, targetAmount: 10001 })
    const rowOf = async (eventId: number) =>
      (await eventService.getById(owner(), eventId)) as Parameters<typeof quoteSplitShare>[0]

    it('is null for fixed events', async () => {
      const event = await create()
      expect(quoteSplitShare(await rowOf(event.id), 0)).toBeNull()
    })

    it.each([0, 1, 3, 4])(
      'matches GET …/price for a one-seat player at %i taken seats',
      async (taken) => {
        const event = await splitEvent()
        for (let i = 1; i <= taken; i++) await book(i, event.id)
        const row = await rowOf(event.id)
        const share = quoteSplitShare(row, taken)!
        // игрок без записи при пустом составе и записавшийся игрок при непустом — ровно их запрос
        const viewer = taken > 0 ? people[1]! : people[4]!
        const player = await readEventPriceQuote(
          { userId: viewer },
          { organizationId: orgId, eventId: event.id, includeDrafts: false },
        )
        expect(share).toEqual(player)
        expect(share.seats).toBe(1)
      },
    )

    it('after settlement returns the settled share without forecast', async () => {
      const event = await splitEvent()
      await book(1, event.id)
      await book(2, event.id)
      await book(3, event.id)
      await eventPricingService.settle(owner(), orgId, event.id)
      const row = await rowOf(event.id)
      const share = quoteSplitShare(row, 3)!
      expect(share).toMatchObject({ basis: 'settled', perSeat: { min: 3333, max: 3334 } })
      const player = await readEventPriceQuote(
        { userId: people[4]! },
        { organizationId: orgId, eventId: event.id, includeDrafts: false },
      )
      expect(share).toEqual(player)
    })

    it('occupancy above capacity does not throw', async () => {
      const event = await splitEvent()
      expect(quoteSplitShare(await rowOf(event.id), 9)).toMatchObject({ basis: 'forecast' })
    })
  })
})
