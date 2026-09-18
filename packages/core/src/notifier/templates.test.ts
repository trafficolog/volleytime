import { describe, expect, it } from 'vitest'

import { esc, formatMoney, renderMessage } from './templates'

describe('notifier templates (pure)', () => {
  it('escapes HTML in event title', () => {
    const m = renderMessage('booking_confirmed', { eventTitle: '<b>Хак</b> & co' })
    expect(m.text).toContain('&lt;b&gt;')
    expect(m.text).toContain('&amp;')
    expect(m.text).not.toContain('<b>Хак')
  })

  it('formats money (minor -> major)', () => {
    expect(formatMoney(1500, 'BYN')).toBe('15,00 BYN')
    expect(formatMoney(0)).toBe('Бесплатно')
  })

  it('booking_confirmed includes title and date', () => {
    const m = renderMessage('booking_confirmed', {
      eventTitle: 'Тренировка',
      eventDate: '1 июня, 18:00',
    })
    expect(m.text).toContain('Тренировка')
    expect(m.text).toContain('1 июня')
  })

  it('waitlist_promoted mentions payment when needed', () => {
    const withPay = renderMessage('waitlist_promoted', { eventTitle: 'X', needsPayment: true })
    expect(withPay.text).toContain('оплат')
    const noPay = renderMessage('waitlist_promoted', { eventTitle: 'X', needsPayment: false })
    expect(noPay.text).not.toContain('оплат')
  })

  it('event_cancelled mentions refund when refunded', () => {
    const m = renderMessage('event_cancelled', { eventTitle: 'X', refunded: true })
    expect(m.text).toContain('возвращена')
  })

  it('adds keyboard when miniAppUrl provided', () => {
    const m = renderMessage('booking_confirmed', {
      eventTitle: 'X',
      miniAppUrl: 'https://vt.by/m/',
    })
    expect(m.keyboard?.[0]?.[0]?.webAppUrl).toBe('https://vt.by/m/')
    const noKb = renderMessage('booking_confirmed', { eventTitle: 'X' })
    expect(noKb.keyboard).toBeUndefined()
  })

  it('payment_confirmed shows amount', () => {
    const m = renderMessage('payment_confirmed', { eventTitle: 'X', amount: 2500, currency: 'BYN' })
    expect(m.text).toContain('25,00 BYN')
  })

  it('esc handles all special chars', () => {
    expect(esc('<a & b>')).toBe('&lt;a &amp; b&gt;')
  })
})

describe('templates ru formatting (8.8.5)', () => {
  it('formats money in ru-RU', () => {
    expect(formatMoney(1500)).toBe('15,00 BYN')
    expect(formatMoney(0)).toBe('Бесплатно')
  })

  it('subscription payment mentions plan, not event', () => {
    const msg = renderMessage('payment_confirmed', { amount: 8000, planName: 'Восемь занятий' })
    expect(msg.text).toContain('Восемь занятий')
  })

  it('adds a button when miniAppUrl is present', () => {
    const msg = renderMessage('booking_confirmed', {
      eventTitle: 'Тренировка',
      eventDate: '18 сентября, 19:00',
      miniAppUrl: 'https://volleytime.by/m/?startapp=event_5',
    })
    expect(msg.text).toContain('18 сентября, 19:00')
    expect(msg.keyboard?.[0]?.[0]?.webAppUrl).toContain('startapp=event_5')
  })
})

describe('booking pending payment notification (8.9.1)', () => {
  it('does not claim the spot is confirmed', () => {
    const msg = renderMessage('booking_pending_payment', {
      eventTitle: 'Тренировка',
      eventDate: '19 сентября, 19:00',
      amount: 1500,
      currency: 'BYN',
      method: 'cash',
    })
    expect(msg.text).not.toContain('Вы записаны')
    expect(msg.text).toContain('забронировано')
    expect(msg.text).toContain('15,00 BYN')
    expect(msg.text).toContain('наличными')
  })

  it('mentions transfer when chosen', () => {
    const msg = renderMessage('booking_pending_payment', { amount: 1500, method: 'transfer' })
    expect(msg.text).toContain('переводом')
  })
})
