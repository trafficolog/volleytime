import { describe, expect, it } from 'vitest'

import { cancelConsequencesOf } from './event-cancel'
import type { RosterBooking } from './organizer-roster'

const b = (over: Partial<RosterBooking> = {}): RosterBooking => ({
  status: 'confirmed',
  method: 'cash',
  seats: 1,
  waitlistSeats: 0,
  paymentId: 1,
  pendingPaymentIds: [],
  paidSeats: 1,
  allocatedAmount: null,
  offer: null,
  ...over,
})

describe('cancelConsequencesOf: последствия отмены события', () => {
  it('пустое событие: уведомлять некого, баланс событий возвращается', () => {
    const c = cancelConsequencesOf([])
    expect(c.activeBookings).toBe(0)
    expect(c.balance).toBe('returned')
    expect(c.lines.join(' ')).toContain('Записей нет')
    expect(c.lines.join(' ')).toContain('вернётся')
  })

  it('любая неотменённая запись, в том числе очередь, блокирует возврат баланса (D-13)', () => {
    expect(
      cancelConsequencesOf([b({ status: 'waitlisted', paymentId: null, paidSeats: 0 })]).balance,
    ).toBe('kept')
    expect(cancelConsequencesOf([b()]).balance).toBe('kept')
    expect(cancelConsequencesOf([b({ status: 'cancelled' })]).balance).toBe('returned')
  })

  it('до открытия записи баланс возвращается и при записях (D-09)', () => {
    const now = new Date('2099-01-01T10:00:00Z')
    const c = cancelConsequencesOf([b()], { bookingOpensAt: '2099-01-02T10:00:00Z', now })
    expect(c.balance).toBe('returned')
    expect(c.lines.join(' ')).toContain('до открытия записи')
    // после открытия — снова блокируют записи
    expect(
      cancelConsequencesOf([b()], { bookingOpensAt: '2098-12-31T10:00:00Z', now }).balance,
    ).toBe('kept')
  })

  it('считает записи и места: оплаченные, ожидающие оплаты, абонементные, очередь', () => {
    const c = cancelConsequencesOf([
      b({ seats: 2, paidSeats: 2 }),
      b({ status: 'attended' }),
      b({ status: 'pending_payment', seats: 2, paidSeats: 0, pendingPaymentIds: [4, 5] }),
      b({ method: 'subscription', paymentId: null, paidSeats: 0 }),
      b({ status: 'waitlisted', paymentId: null, seats: 2, paidSeats: 0 }),
      b({ status: 'cancelled' }),
    ])
    expect(c).toMatchObject({
      activeBookings: 5,
      inMain: 4,
      waitlisted: 1,
      paidSeats: 3,
      unpaidSeats: 2,
      subscriptionSeats: 1,
      balance: 'kept',
    })
    const text = c.lines.join('\n')
    expect(text).toContain('Записи будут отменены: 5')
    expect(text).toContain('8 мест')
    expect(text).toContain('уведомление')
    expect(text).toContain('листе ожидания')
    expect(text).toContain('Оплаченные места (3)')
    expect(text).toContain('отметятся возвращёнными')
    expect(text).toContain('Неоплаченные места (2)')
    expect(text).toContain('занятия (1) вернутся')
    expect(text).toContain('не возвращается')
  })

  it('смешанная запись абонемент + наличные: наличные места считаются возвращёнными', () => {
    const c = cancelConsequencesOf([
      b({ method: 'subscription', seats: 3, paidSeats: 2, paymentId: 1 }),
    ])
    expect(c).toMatchObject({ paidSeats: 2, subscriptionSeats: 1 })
  })

  it('отменённые записи split с зафиксированной долей: доля тоже возвращается', () => {
    const c = cancelConsequencesOf([
      b({ status: 'cancelled', allocatedAmount: 1500, paidSeats: 0 }),
      b({ status: 'cancelled', allocatedAmount: null, paidSeats: 0 }),
    ])
    expect(c.releasedShares).toBe(1)
    expect(c.lines.join(' ')).toContain('зафиксированной долей (1)')
  })

  it('частичная очередь у записи в основе считается очередью', () => {
    expect(cancelConsequencesOf([b({ seats: 2, waitlistSeats: 2 })]).queuedSeats).toBe(2)
  })

  it('неизвестный состав (не загружен) — общий текст без выдуманных чисел', () => {
    const c = cancelConsequencesOf(null)
    expect(c.activeBookings).toBeNull()
    expect(c.lines.join(' ')).toContain('Состав не загружен')
    expect(c.lines.join(' ')).not.toMatch(/\d/)
  })
})
