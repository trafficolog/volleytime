import { describe, expect, it } from 'vitest'

import { cancelConsequencesOf } from './event-cancel'
import type { RosterBooking } from './organizer-roster'

const b = (over: Partial<RosterBooking> = {}): RosterBooking => ({
  status: 'confirmed',
  method: 'cash',
  seats: 1,
  waitlistSeats: 0,
  paymentId: 1,
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
    expect(cancelConsequencesOf([b({ status: 'waitlisted', paymentId: null })]).balance).toBe(
      'kept',
    )
    expect(cancelConsequencesOf([b()]).balance).toBe('kept')
    expect(cancelConsequencesOf([b({ status: 'cancelled' })]).balance).toBe('returned')
  })

  it('считает записи, очередь, оплаченные, ожидающие оплаты и абонементы', () => {
    const c = cancelConsequencesOf([
      b(),
      b({ status: 'attended' }),
      b({ status: 'pending_payment', paymentId: 4 }),
      b({ method: 'subscription', paymentId: null }),
      b({ status: 'waitlisted', paymentId: null, seats: 2 }),
      b({ status: 'cancelled' }),
    ])
    expect(c).toMatchObject({
      activeBookings: 5,
      inMain: 4,
      waitlisted: 1,
      paid: 2,
      unpaid: 1,
      subscription: 1,
      balance: 'kept',
    })
    const text = c.lines.join('\n')
    expect(text).toContain('Записи будут отменены: 5')
    expect(text).toContain('уведомление')
    expect(text).toContain('листе ожидания')
    expect(text).toContain('отметятся возвращёнными')
    expect(text).toContain('занятия вернутся')
    expect(text).toContain('не возвращается')
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
