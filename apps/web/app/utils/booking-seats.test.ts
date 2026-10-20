import { BookInput } from '@volley-time/core'
import { describe, expect, it } from 'vitest'

import {
  bookingSubmitLabel,
  canSubmitBooking,
  clampSeats,
  maxSeatsFor,
  myBookingSeatsText,
  myBookingTitle,
  offerCountdown,
  offerDeadlineLabel,
  OFFER_EXPIRED_TEXT,
  planSeats,
  seatsHeadline,
  seatsLabel,
  seatsUpTo,
} from './booking-seats'
import { bookingPayload } from './player-event-action'

describe('seatsLabel', () => {
  it.each([
    [1, '1 место'],
    [2, '2 места'],
    [4, '4 места'],
    [5, '5 мест'],
    [11, '11 мест'],
    [21, '21 место'],
  ])('%i → %s', (n, text) => expect(seatsLabel(n)).toBe(text))
})

describe('seatsUpTo', () => {
  it.each([
    [1, '1 места'],
    [2, '2 мест'],
    [3, '3 мест'],
    [5, '5 мест'],
    [21, '21 места'],
  ])('до %i → %s', (n, text) => expect(seatsUpTo(n)).toBe(text))
})

describe('maxSeatsFor', () => {
  it('is one seat while EVENT_MULTI_SEAT_ENABLED is off', () => {
    expect(maxSeatsFor({ maxSeatsPerBooking: 3, capacity: 14, multiSeatEnabled: false })).toBe(1)
  })
  it('is limited by the group max and by the event capacity', () => {
    expect(maxSeatsFor({ maxSeatsPerBooking: 3, capacity: 14, multiSeatEnabled: true })).toBe(3)
    expect(maxSeatsFor({ maxSeatsPerBooking: 5, capacity: 2, multiSeatEnabled: true })).toBe(2)
  })
  it('never drops below one seat', () => {
    expect(maxSeatsFor({ maxSeatsPerBooking: null, capacity: 0, multiSeatEnabled: true })).toBe(1)
  })
})

describe('clampSeats', () => {
  it('keeps the stepper inside 1..max', () => {
    expect(clampSeats(0, 3)).toBe(1)
    expect(clampSeats(4, 3)).toBe(3)
    expect(clampSeats(2, 3)).toBe(2)
    expect(clampSeats(Number.NaN, 3)).toBe(1)
  })
})

describe('planSeats and consent', () => {
  it('free seats cover the choice: all in the main roster, no consent', () => {
    const plan = planSeats(2, 5)
    expect(plan).toMatchObject({ kind: 'main', mainSeats: 2, queueSeats: 0, needsConsent: false })
    expect(canSubmitBooking(plan, false)).toBe(true)
  })
  it('no free seats: the whole booking goes to the queue, no consent needed', () => {
    const plan = planSeats(2, 0)
    expect(plan).toMatchObject({ kind: 'queue', mainSeats: 0, queueSeats: 2, needsConsent: false })
    expect(canSubmitBooking(plan, false)).toBe(true)
  })
  it('more seats than free: partial queue is blocked until the player agrees', () => {
    const plan = planSeats(3, 1)
    expect(plan).toMatchObject({ kind: 'partial', mainSeats: 1, queueSeats: 2, needsConsent: true })
    expect(canSubmitBooking(plan, false)).toBe(false)
    expect(canSubmitBooking(plan, true)).toBe(true)
  })
})

describe('labels', () => {
  it('submit label follows the plan', () => {
    expect(bookingSubmitLabel(planSeats(1, 4))).toBe('Записаться')
    expect(bookingSubmitLabel(planSeats(2, 4))).toBe('Записаться · 2 места')
    expect(bookingSubmitLabel(planSeats(1, 0))).toBe('Встать в лист ожидания')
    expect(bookingSubmitLabel(planSeats(3, 0))).toBe('В лист ожидания · 3 места')
    expect(bookingSubmitLabel(planSeats(3, 1))).toBe('Записаться · 3 места')
  })
  it('headline and my-booking texts', () => {
    expect(seatsHeadline(1)).toBe('Только я')
    expect(seatsHeadline(3)).toBe('Я и ещё 2')
    expect(myBookingTitle({ status: 'confirmed', seats: 2 }, 'Вы записаны')).toBe(
      'Вы записаны на 2 места',
    )
    expect(myBookingTitle({ status: 'confirmed', seats: 1 }, 'Вы записаны')).toBe('Вы записаны')
    expect(myBookingTitle({ status: 'waitlisted', seats: 2 }, 'Вы в листе ожидания')).toBe(
      'Вы в листе ожидания',
    )
    expect(myBookingSeatsText({ status: 'waitlisted', seats: 2 })).toBe('В очереди на 2 места')
    expect(myBookingSeatsText({ status: 'confirmed', seats: 1, waitlistSeats: 2 })).toBe(
      '1 место за вами, ещё 2 места в очереди',
    )
    expect(myBookingSeatsText({ status: 'confirmed', seats: 2, waitlistSeats: 0 })).toBeNull()
  })
})

describe('offerDeadlineLabel (20.4.11)', () => {
  it('names the absolute confirm-by time in the group timezone', () => {
    expect(offerDeadlineLabel('2027-10-03T10:29:41Z', 'Europe/Minsk')).toBe('Подтвердить до 13:29')
    expect(offerDeadlineLabel(new Date('2027-10-03T23:50:00Z'), 'Europe/Minsk')).toBe(
      'Подтвердить до 02:50',
    )
  })
})

describe('offerCountdown', () => {
  const now = new Date('2027-10-03T10:00:00Z')
  it('counts down in mm:ss', () => {
    const left = offerCountdown('2027-10-03T10:29:41Z', now)
    expect(left).toMatchObject({ expired: false, clock: '29:41', text: 'Осталось 29:41' })
  })
  it('rounds a partial second up so the last second is still acceptable', () => {
    expect(offerCountdown(new Date(now.getTime() + 400), now).clock).toBe('0:01')
  })
  it('after the TTL the player has left the queue (owner decision 2026-10-16)', () => {
    const left = offerCountdown('2027-10-03T10:00:00Z', now)
    expect(left).toMatchObject({ expired: true, secondsLeft: 0, text: OFFER_EXPIRED_TEXT })
    expect(OFFER_EXPIRED_TEXT).toContain('покинули очередь')
    expect(OFFER_EXPIRED_TEXT).not.toContain('в конец')
  })
})

/** Контракт: тело запроса разбирается схемами API (20.1.2), которые проверит сервер. */
describe('request bodies parse with the API schemas', () => {
  it('single seat sends the pre-20.1.2 body and parses to one seat without queue consent', () => {
    const body = bookingPayload('cash')
    expect(body).toEqual({ method: 'cash' })
    expect(BookInput.parse(body)).toMatchObject({ method: 'cash', seats: 1, allowWaitlist: false })
  })
  it('several seats are sent as seats; the partial queue as allowWaitlist', () => {
    const body = bookingPayload('transfer', undefined, { seats: 3, allowWaitlist: true })
    expect(body).toEqual({ method: 'transfer', seats: 3, allowWaitlist: true })
    expect(BookInput.parse(body)).toMatchObject({ seats: 3, allowWaitlist: true })
  })
  it('allowWaitlist is not sent without consent, one seat is not sent as seats', () => {
    expect(bookingPayload('cash', undefined, { seats: 2, allowWaitlist: false })).toEqual({
      method: 'cash',
      seats: 2,
    })
    expect(bookingPayload('cash', undefined, { seats: 1 })).toEqual({ method: 'cash' })
  })
  it('subscription keeps its id and seats', () => {
    const body = bookingPayload('subscription', 9, { seats: 2 })
    expect(body).toEqual({ method: 'subscription', subscriptionId: 9, seats: 2 })
    expect(BookInput.parse(body)).toMatchObject({ subscriptionId: 9, seats: 2 })
  })
})
