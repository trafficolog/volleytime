import { closeDb, db, organizations, users } from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { ledgerService } from '../ledger/service'
import { memberService } from '../members/service'
import { organizationService } from '../organizations/service'

import { PaymentNotPendingError, PaymentNotSucceededError } from './errors'
import { paymentService } from './service'

let ownerId: number
let orgId: number

const future = (h = 24) => new Date(Date.now() + h * 3600_000)

async function newPlayer() {
  const [u] = await db
    .insert(users)
    .values({ email: `pay-${Math.random()}@t.by` })
    .returning()
  await memberService.add({ userId: ownerId }, { organizationId: orgId, userId: u!.id })
  return u!.id
}

async function bookedPayment(price = 1500) {
  const ev = await eventService.create({ userId: ownerId }, orgId, {
    title: 'Платная',
    startsAt: future(),
    endsAt: future(26),
    capacity: 5,
    price,
  })
  const pid = await newPlayer()
  const booking = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
  // book() автоматически создаёт pending payment (Phase 6.3)
  const payment = await paymentService.getById({ userId: ownerId }, booking.paymentId!)
  return { ev, pid, booking, payment }
}

describe('paymentService + ledger (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    const org = await organizationService.create({ userId: ownerId }, { name: 'Pay Org' })
    orgId = org.id
  })

  it('confirm: payment succeeded + booking confirmed + ledger income', async () => {
    const { booking, payment } = await bookedPayment(1500)
    expect(booking.status).toBe('pending_payment')

    const confirmed = await paymentService.confirm({ userId: ownerId }, payment.id)
    expect(confirmed.status).toBe('succeeded')
    expect(confirmed.confirmedByUserId).toBe(ownerId)

    const b = await bookingService.getById({ userId: ownerId }, booking.id)
    expect(b.status).toBe('confirmed')

    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance.income).toBe(1500)
    expect(balance.balance).toBe(1500)
  })

  it('booking cancelled → its pending payment cancelled, confirm → 409 (6.8.6)', async () => {
    const { booking, payment, pid } = await bookedPayment()
    await bookingService.cancel({ userId: pid }, booking.id)
    await expect(paymentService.confirm({ userId: ownerId }, payment.id)).rejects.toThrow(
      PaymentNotPendingError,
    )
    const b = await bookingService.getById({ userId: ownerId }, booking.id)
    expect(b.status).toBe('cancelled')
  })

  it('confirm non-pending → PaymentNotPendingError', async () => {
    const { payment } = await bookedPayment()
    await paymentService.confirm({ userId: ownerId }, payment.id)
    await expect(paymentService.confirm({ userId: ownerId }, payment.id)).rejects.toThrow(
      PaymentNotPendingError,
    )
  })

  it('cancel: payment cancelled + booking cancelled', async () => {
    const { booking, payment } = await bookedPayment()
    const cancelled = await paymentService.cancel({ userId: ownerId }, payment.id)
    expect(cancelled.status).toBe('cancelled')
    const b = await bookingService.getById({ userId: ownerId }, booking.id)
    expect(b.status).toBe('cancelled')
  })

  it('refund: succeeded → refunded + ledger expense (net zero)', async () => {
    const { payment } = await bookedPayment(2000)
    await paymentService.confirm({ userId: ownerId }, payment.id)
    const refunded = await paymentService.refund({ userId: ownerId }, payment.id, 'Отмена события')
    expect(refunded.status).toBe('refunded')

    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance.income).toBe(2000)
    expect(balance.expense).toBe(2000)
    expect(balance.balance).toBe(0) // net zero
  })

  it('refund non-succeeded → PaymentNotSucceededError', async () => {
    const { payment } = await bookedPayment()
    await expect(paymentService.refund({ userId: ownerId }, payment.id)).rejects.toThrow(
      PaymentNotSucceededError,
    )
  })

  it('listPending returns only pending', async () => {
    const a = await bookedPayment()
    await bookedPayment()
    await paymentService.confirm({ userId: ownerId }, a.payment.id)
    const pending = await paymentService.listPending({ userId: ownerId }, orgId)
    expect(pending).toHaveLength(1)
  })

  it('ledger: manual expense decreases balance', async () => {
    const { payment } = await bookedPayment(5000)
    await paymentService.confirm({ userId: ownerId }, payment.id)
    await ledgerService.addExpense({ userId: ownerId }, orgId, {
      category: 'rent',
      amount: 3000,
      description: 'Аренда зала',
    })
    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance.balance).toBe(2000)
  })

  it('ledger: history filters by type', async () => {
    const { payment } = await bookedPayment(1000)
    await paymentService.confirm({ userId: ownerId }, payment.id)
    await ledgerService.addExpense({ userId: ownerId }, orgId, {
      category: 'equipment',
      amount: 500,
    })
    const expenses = await ledgerService.listHistory({ userId: ownerId }, orgId, {
      type: 'expense',
    })
    expect(expenses.every((e) => e.type === 'expense')).toBe(true)
    expect(expenses).toHaveLength(1)
  })

  it('INTEGRATION: book(cash) auto-creates pending payment linked to booking', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Авто-платёж',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 2500,
    })
    const pid = await newPlayer()
    const booking = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
    expect(booking.status).toBe('pending_payment')
    expect(booking.paymentId).toBeTruthy()

    const payment = await paymentService.getById({ userId: ownerId }, booking.paymentId!)
    expect(payment.amount).toBe(2500)
    expect(payment.status).toBe('pending')
    expect(payment.bookingId).toBe(booking.id)
  })

  it('INTEGRATION: promotion to pending_payment creates payment', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Промо-платёж',
      startsAt: future(),
      endsAt: future(26),
      capacity: 1,
      price: 1200,
    })
    const p1 = await newPlayer()
    const p2 = await newPlayer()
    const b1 = await bookingService.book({ userId: p1 }, orgId, ev.id, { method: 'cash' })
    const b2 = await bookingService.book({ userId: p2 }, orgId, ev.id, { method: 'cash' })
    expect(b2.status).toBe('waitlisted')
    expect(b2.paymentId).toBeNull() // waitlist без платежа

    const { promoted } = await bookingService.cancel({ userId: ownerId }, b1.id, { byAdmin: true })
    expect(promoted?.status).toBe('pending_payment')
    expect(promoted?.paymentId).toBeTruthy()
  })

  it('INTEGRATION: full money flow — book → confirm → balance', async () => {
    const ev = await eventService.create({ userId: ownerId }, orgId, {
      title: 'Денежный поток',
      startsAt: future(),
      endsAt: future(26),
      capacity: 5,
      price: 3000,
    })
    const pid = await newPlayer()
    const booking = await bookingService.book({ userId: pid }, orgId, ev.id, { method: 'cash' })
    await paymentService.confirm({ userId: ownerId }, booking.paymentId!)

    const b = await bookingService.getById({ userId: ownerId }, booking.id)
    expect(b.status).toBe('confirmed')
    const balance = await ledgerService.getBalance({ userId: ownerId }, orgId)
    expect(balance.balance).toBe(3000)
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })
})
