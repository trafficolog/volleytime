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

describe('invite request templates (20.4.7)', () => {
  it('organizer is told who asks for an invitation to which event', () => {
    const m = renderMessage('invite_request_organizer', {
      eventTitle: 'Основа <1>',
      eventDate: '30 мая, 20:00',
      playerName: 'Соня',
      miniAppUrl: 'https://vt.by/m/?startapp=event_5',
    })
    expect(m.text).toContain('Запрос приглашения')
    expect(m.text).toContain('Соня')
    expect(m.text).toContain('Основа &lt;1&gt;')
    expect(m.keyboard?.[0]?.[0]?.webAppUrl).toBe('https://vt.by/m/?startapp=event_5')
  })

  it('player gets the answer: approved invites to book, declined allows asking again', () => {
    const yes = renderMessage('invite_request_decided', {
      eventTitle: 'Основа',
      eventDate: '30 мая, 20:00',
      inviteApproved: true,
    })
    expect(yes.text).toContain('пригласил')
    expect(yes.text).toContain('Основа')
    const no = renderMessage('invite_request_decided', {
      eventTitle: 'Основа',
      inviteApproved: false,
    })
    expect(no.text).toContain('не смог')
    expect(no.text).toContain('снова')
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

describe('split pricing notifications (8.11.1)', () => {
  it('split_reservation_is_not_free_or_payment_request', () => {
    const message = renderMessage('split_booking_reserved', {
      eventTitle: '<Тренировка> & команда',
      eventDate: '2 октября, 19:00',
      miniAppUrl: 'https://volleytime.by/m/?startapp=event_5',
    })
    expect(message?.text).toContain('Точная сумма после закрытия записи')
    expect(message?.text).toContain('Место')
    expect(message?.text).toContain('&lt;Тренировка&gt; &amp; команда')
    expect(message?.text).not.toContain('Бесплатно')
    expect(message?.text).not.toMatch(/оплатите|не забудьте оплатить|BYN/i)
    expect(message?.keyboard?.[0]?.[0]?.webAppUrl).toContain('startapp=event_5')
  })

  it.each([
    { method: 'cash', wording: 'наличными' },
    { method: 'transfer', wording: 'переводом' },
  ])('split_price_settled states exact personal amount and $method', ({ method, wording }) => {
    const message = renderMessage('split_price_settled', {
      eventTitle: '<Игра>',
      amount: 3334,
      currency: 'BYN',
      method,
      miniAppUrl: 'https://volleytime.by/m/?startapp=event_5',
    })
    expect(message?.text).toContain('33,34 BYN')
    expect(message?.text).toContain(wording)
    expect(message?.text).toContain('&lt;Игра&gt;')
    expect(message?.text).not.toMatch(/прогноз|Бесплатно/)
    expect(message?.keyboard?.[0]?.[0]?.webAppUrl).toContain('startapp=event_5')
  })

  it('organizer summary distinguishes allocation from received payment', () => {
    const message = renderMessage('split_settled_organizer', {
      eventTitle: '<Игра>',
      targetAmount: 10000,
      participantCount: 3,
      currency: 'BYN',
    })
    expect(message?.text).toContain('100,00 BYN')
    expect(message?.text).toContain('Участников: 3')
    expect(message?.text).toContain('&lt;Игра&gt;')
    expect(message?.text).not.toMatch(/получено|оплата подтверждена/i)
  })
})

describe('кнопки действий в уведомлениях (20.3.3)', () => {
  const base = { eventId: 5, organizationId: 1, miniAppUrl: 'https://vt.by/m/?startapp=event_5' }
  const callbacks = (type: Parameters<typeof renderMessage>[0]) =>
    (renderMessage(type, base).keyboard ?? []).flat().flatMap((b) => (b.callbackData ? [b] : []))

  it('напоминание 24 ч: «Не смогу прийти» после ссылки «Открыть»', () => {
    const m = renderMessage('reminder_24h', base)
    expect(m.keyboard?.[0]?.[0]?.webAppUrl).toContain('startapp=event_5')
    expect(m.keyboard?.[1]).toEqual([{ text: 'Не смогу прийти', callbackData: 'cx:5' }])
  })
  it('напоминание 2 ч: «Не смогу»', () => {
    expect(callbacks('reminder_2h')).toEqual([{ text: 'Не смогу', callbackData: 'cx:5' }])
  })
  it('предложение места: «Беру место»', () => {
    expect(callbacks('waitlist_offer')).toEqual([{ text: 'Беру место', callbackData: 'oa:5' }])
  })
  it('без id события кнопки действия нет; callback_data укладывается в лимит Bot API', () => {
    expect(
      (renderMessage('reminder_24h', { miniAppUrl: 'https://vt.by/m/' }).keyboard ?? [])
        .flat()
        .some((b) => b.callbackData),
    ).toBe(false)
    for (const t of ['reminder_24h', 'reminder_2h', 'waitlist_offer'] as const)
      for (const b of callbacks(t))
        expect(Buffer.byteLength(b.callbackData!)).toBeLessThanOrEqual(64)
  })
  it('прочие типы без кнопок действий', () => {
    expect(callbacks('booking_confirmed')).toEqual([])
    expect(callbacks('payment_confirmed')).toEqual([])
  })
})
