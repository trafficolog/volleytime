import {
  auditLog,
  closeDb,
  db,
  eq,
  ledgerEntries,
  organizationMembers,
  organizationPaymentMethods,
  organizations,
  payments,
  users,
} from '@volley-time/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { AUDIT_ACTIONS } from '../audit/actions'
import { bookingService } from '../bookings/service'
import { eventService } from '../events/service'
import { organizationService } from '../organizations/service'
import { paymentService } from '../payments/service'

import { PaymentMethodInvalidError } from './errors'
import { paymentMethodService } from './service'

let ownerId: number
let orgId: number

const ctx = () => ({ userId: ownerId })
const future = (h = 24) => new Date(Date.now() + h * 3600_000)

async function newPlayer(): Promise<number> {
  const [u] = await db
    .insert(users)
    .values({ email: `p-${Math.random()}@t.by` })
    .returning()
  await db.insert(organizationMembers).values({ organizationId: orgId, userId: u!.id })
  return u!.id
}

async function makeEvent() {
  return eventService.create(ctx(), orgId, {
    title: 'Тренировка',
    startsAt: future(),
    endsAt: future(26),
    capacity: 10,
    price: 1500,
  })
}

const auditRows = () =>
  db.select().from(auditLog).where(eq(auditLog.action, AUDIT_ACTIONS.ORG_PAYMENT_METHOD_UPDATED))

/** Task 21.2.11: способы оплаты группы (включение, реквизиты перевода). */
describe('paymentMethodService (integration)', () => {
  beforeEach(async () => {
    await db.delete(organizations)
    await db.delete(users)
    const [u] = await db
      .insert(users)
      .values({ email: `o-${Math.random()}@t.by` })
      .returning()
    ownerId = u!.id
    orgId = (await organizationService.create(ctx(), { name: 'Pay Org' })).id
  })

  afterAll(async () => {
    await db.delete(organizations)
    await db.delete(users)
    await closeDb()
  })

  describe('list', () => {
    it('treats a missing row as enabled without requisites (behaviour before 21.2.11)', async () => {
      const manager = await paymentMethodService.list(ctx(), orgId, { manager: true })
      expect(manager).toEqual([
        { method: 'cash', enabled: true, bank: null, cardLast4: null, recipient: null },
        { method: 'transfer', enabled: true, bank: null, cardLast4: null, recipient: null },
      ])
      expect(await paymentMethodService.list(ctx(), orgId, { manager: false })).toEqual(manager)
    })

    it('hides disabled methods and their requisites from players, shows all to managers', async () => {
      await paymentMethodService.update(ctx(), orgId, 'transfer', {
        bank: 'Belarusbank',
        cardLast4: '3214',
        recipient: 'Иван П.',
        enabled: false,
      })
      const player = await paymentMethodService.list(ctx(), orgId, { manager: false })
      expect(player.map((m) => m.method)).toEqual(['cash'])
      const manager = await paymentMethodService.list(ctx(), orgId, { manager: true })
      expect(manager.find((m) => m.method === 'transfer')).toEqual({
        method: 'transfer',
        enabled: false,
        bank: 'Belarusbank',
        cardLast4: '3214',
        recipient: 'Иван П.',
      })
    })

    it('returns an empty list to players when every method is off', async () => {
      await paymentMethodService.update(ctx(), orgId, 'cash', { enabled: false })
      await paymentMethodService.update(ctx(), orgId, 'transfer', { enabled: false })
      expect(await paymentMethodService.list(ctx(), orgId, { manager: false })).toEqual([])
      expect(await paymentMethodService.list(ctx(), orgId, { manager: true })).toHaveLength(2)
    })

    it('does not leak requisites of another group', async () => {
      const other = await organizationService.create(ctx(), { name: 'Other' })
      await paymentMethodService.update(ctx(), other.id, 'transfer', { bank: 'Секретбанк' })
      const mine = await paymentMethodService.list(ctx(), orgId, { manager: true })
      expect(JSON.stringify(mine)).not.toContain('Секретбанк')
    })
  })

  describe('update', () => {
    it('stores requisites, returns them and audits the change with the author', async () => {
      const result = await paymentMethodService.update(ctx(), orgId, 'transfer', {
        bank: '  Belarusbank ',
        cardLast4: '3214',
        recipient: 'Иван П.',
      })
      expect(result).toEqual({
        method: 'transfer',
        enabled: true,
        bank: 'Belarusbank',
        cardLast4: '3214',
        recipient: 'Иван П.',
      })
      const [entry] = await auditRows()
      expect(entry!.userId).toBe(ownerId)
      expect(entry!.organizationId).toBe(orgId)
      expect(entry!.newValue).toEqual({
        method: 'transfer',
        bank: 'Belarusbank',
        cardLast4: '3214',
        recipient: 'Иван П.',
      })
      expect(entry!.oldValue).toEqual({
        method: 'transfer',
        bank: null,
        cardLast4: null,
        recipient: null,
      })
    })

    it('writes no audit entry when nothing changes', async () => {
      await paymentMethodService.update(ctx(), orgId, 'transfer', { bank: 'A' })
      await paymentMethodService.update(ctx(), orgId, 'transfer', { bank: 'A' })
      await paymentMethodService.update(ctx(), orgId, 'cash', { enabled: true })
      expect(await auditRows()).toHaveLength(1)
    })

    it('updates one field and keeps the rest', async () => {
      await paymentMethodService.update(ctx(), orgId, 'transfer', {
        bank: 'A',
        cardLast4: '1111',
        recipient: 'B',
      })
      const result = await paymentMethodService.update(ctx(), orgId, 'transfer', { enabled: false })
      expect(result).toMatchObject({ enabled: false, bank: 'A', cardLast4: '1111', recipient: 'B' })
      const result2 = await paymentMethodService.update(ctx(), orgId, 'transfer', {
        cardLast4: null,
        recipient: '',
      })
      expect(result2).toMatchObject({ bank: 'A', cardLast4: null, recipient: null })
    })

    it.each(['1234', ' 3214 '])('accepts exactly four digits (%j)', async (value) => {
      const r = await paymentMethodService.update(ctx(), orgId, 'transfer', { cardLast4: value })
      expect(r.cardLast4).toBe(value.trim())
    })

    it.each(['123', '12345', '4111111111111111', '41 11', 'abcd', '12a4'])(
      'rejects cardLast4 %j',
      async (value) => {
        await expect(
          paymentMethodService.update(ctx(), orgId, 'transfer', { cardLast4: value }),
        ).rejects.toThrow()
        expect(await db.select().from(organizationPaymentMethods)).toHaveLength(0)
      },
    )

    it.each([
      '4111 1111 1111 1111',
      '4111-1111-1111-1111',
      '4111111111111111',
      'Иван П. 123456789',
      '1234 5678 9',
    ])('rejects a full card or account number in text fields (%j)', async (value) => {
      await expect(
        paymentMethodService.update(ctx(), orgId, 'transfer', { recipient: value }),
      ).rejects.toThrow(/Номер карты не принимается/)
      await expect(
        paymentMethodService.update(ctx(), orgId, 'transfer', { bank: value }),
      ).rejects.toThrow(/Номер карты не принимается/)
      expect(await db.select().from(organizationPaymentMethods)).toHaveLength(0)
      expect(await auditRows()).toHaveLength(0)
    })

    it('accepts text with a short number and the boundary of eight digits', async () => {
      const r = await paymentMethodService.update(ctx(), orgId, 'transfer', {
        bank: 'Банк №5',
        recipient: 'Иван П. 12345678',
      })
      expect(r).toMatchObject({ bank: 'Банк №5', recipient: 'Иван П. 12345678' })
    })

    it('rejects too long text, unknown keys (cardNumber), empty patch and unknown fields', async () => {
      await expect(
        paymentMethodService.update(ctx(), orgId, 'transfer', { bank: 'x'.repeat(101) }),
      ).rejects.toThrow()
      await expect(
        paymentMethodService.update(ctx(), orgId, 'transfer', {
          cardNumber: '4111111111111111',
        } as never),
      ).rejects.toThrow()
      await expect(paymentMethodService.update(ctx(), orgId, 'transfer', {})).rejects.toThrow(
        PaymentMethodInvalidError,
      )
      expect(await auditRows()).toHaveLength(0)
    })

    it('has no requisites for cash', async () => {
      await expect(
        paymentMethodService.update(ctx(), orgId, 'cash', { bank: 'A' }),
      ).rejects.toThrow(PaymentMethodInvalidError)
      const r = await paymentMethodService.update(ctx(), orgId, 'cash', { enabled: false })
      expect(r).toMatchObject({ method: 'cash', enabled: false, bank: null })
    })

    it('never persists or audits a full card number', async () => {
      await paymentMethodService.update(ctx(), orgId, 'transfer', {
        bank: 'Belarusbank',
        cardLast4: '1111',
      })
      await expect(
        paymentMethodService.update(ctx(), orgId, 'transfer', { bank: '4111 1111 1111 1111' }),
      ).rejects.toThrow()
      const dump = JSON.stringify([
        await db.select().from(organizationPaymentMethods),
        await db.select().from(auditLog),
      ])
      expect(dump).not.toMatch(/\d{9,}/)
      expect(dump).not.toContain('4111')
    })

    it('refuses an archived group and an unknown group', async () => {
      await db.update(organizations).set({ status: 'archived' }).where(eq(organizations.id, orgId))
      await expect(
        paymentMethodService.update(ctx(), orgId, 'cash', { enabled: false }),
      ).rejects.toMatchObject({ code: 'organization.archived' })
      await expect(
        paymentMethodService.update(ctx(), orgId + 9999, 'cash', { enabled: false }),
      ).rejects.toMatchObject({ code: 'organization.not_found' })
    })
  })

  /**
   * Решение владельца 2026-11-06 (вариант A): выключенный способ меняет только экран оплаты.
   * Запись, подтверждение и касса работают как раньше.
   */
  describe('money parity: a disabled method changes nothing in bookings and the cash desk', () => {
    it('still books with a disabled method and confirms the payment into the ledger', async () => {
      await paymentMethodService.update(ctx(), orgId, 'cash', { enabled: false })
      await paymentMethodService.update(ctx(), orgId, 'transfer', { enabled: false })
      const ev = await makeEvent()
      for (const method of ['cash', 'transfer'] as const) {
        const booking = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
          method,
        })
        expect(booking.status).toBe('pending_payment')
        const [payment] = await db
          .select()
          .from(payments)
          .where(eq(payments.id, booking.paymentId!))
        expect(payment).toMatchObject({ method, status: 'pending', amount: 1500 })

        const confirmed = await paymentService.confirm(ctx(), booking.paymentId!, { orgId })
        expect(confirmed.status).toBe('succeeded')
        const entries = await db
          .select()
          .from(ledgerEntries)
          .where(eq(ledgerEntries.paymentId, booking.paymentId!))
        expect(entries).toHaveLength(1)
        expect(entries[0]).toMatchObject({
          type: 'income',
          category: 'payment_income',
          amount: 1500,
          organizationId: orgId,
        })
      }
    })

    it('confirms a payment that was pending before the method was switched off', async () => {
      const ev = await makeEvent()
      const booking = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
        method: 'transfer',
      })
      const before = await db.select().from(payments).where(eq(payments.id, booking.paymentId!))

      await paymentMethodService.update(ctx(), orgId, 'transfer', { enabled: false })
      const during = await db.select().from(payments).where(eq(payments.id, booking.paymentId!))
      expect(during).toEqual(before)

      await paymentService.confirm(ctx(), booking.paymentId!, { orgId })
      const [after] = await db.select().from(payments).where(eq(payments.id, booking.paymentId!))
      expect(after).toMatchObject({ status: 'succeeded', method: 'transfer' })
      expect(
        await db
          .select()
          .from(ledgerEntries)
          .where(eq(ledgerEntries.paymentId, booking.paymentId!)),
      ).toHaveLength(1)
    })

    it('changing requisites rewrites no payment and no ledger row', async () => {
      const ev = await makeEvent()
      const booking = await bookingService.book({ userId: await newPlayer() }, orgId, ev.id, {
        method: 'transfer',
      })
      const payments0 = await db.select().from(payments)
      const ledger0 = await db.select().from(ledgerEntries)
      await paymentMethodService.update(ctx(), orgId, 'transfer', {
        bank: 'Belarusbank',
        cardLast4: '3214',
        enabled: false,
      })
      expect(await db.select().from(payments)).toEqual(payments0)
      expect(await db.select().from(ledgerEntries)).toEqual(ledger0)
      expect(booking.paymentId).toBeTruthy()
    })
  })
})
