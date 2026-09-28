import { describe, expect, it } from 'vitest'

import {
  bookingPayload,
  runPlayerEventAction,
  shouldRefreshPlayerEventAfterRejection,
} from './player-event-action'

describe('player booking request', () => {
  it('sends only the selected MVP payment method and an eligible subscription ID', () => {
    expect(bookingPayload('free')).toEqual({ method: 'free' })
    expect(bookingPayload('cash')).toEqual({ method: 'cash' })
    expect(bookingPayload('transfer')).toEqual({ method: 'transfer' })
    expect(bookingPayload('subscription', 7)).toEqual({ method: 'subscription', subscriptionId: 7 })
  })

  it('does not submit a subscription without a selected positive ID', () => {
    expect(() => bookingPayload('subscription')).toThrow()
    expect(() => bookingPayload('subscription', 0)).toThrow()
  })
})

describe('server-backed player mutation', () => {
  it('refreshes stale event or booking conflicts but not unknown failures', () => {
    expect(shouldRefreshPlayerEventAfterRejection('booking.event_not_bookable')).toBe(true)
    expect(shouldRefreshPlayerEventAfterRejection('booking.not_cancellable')).toBe(true)
    expect(shouldRefreshPlayerEventAfterRejection('booking.deadline_passed')).toBe(true)
    expect(shouldRefreshPlayerEventAfterRejection('booking.already_booked')).toBe(true)
    expect(shouldRefreshPlayerEventAfterRejection('booking.method_not_allowed')).toBe(true)
    expect(shouldRefreshPlayerEventAfterRejection('network.timeout')).toBe(false)
    expect(shouldRefreshPlayerEventAfterRejection(null)).toBe(false)
    expect(shouldRefreshPlayerEventAfterRejection(undefined)).toBe(false)
  })

  it('keeps the previous booking after server rejection', async () => {
    let state = 'not booked'
    const outcome = await runPlayerEventAction(
      () => Promise.reject(new Error('event is no longer bookable')),
      () => true,
      () => {
        state = 'booked'
      },
    )
    expect(outcome.kind).toBe('error')
    expect(state).toBe('not booked')
  })

  it('keeps the booking when the cancellation deadline passed on the server', async () => {
    let state = 'confirmed'
    const outcome = await runPlayerEventAction(
      () => Promise.reject(new Error('booking.deadline_passed')),
      () => true,
      () => {
        state = 'cancelled'
      },
    )
    expect(outcome.kind).toBe('error')
    expect(state).toBe('confirmed')
  })

  it('ignores a successful response for an event left during the request', async () => {
    let complete!: () => void
    let current = true
    let state = 'not booked'
    const pending = runPlayerEventAction(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve
        }),
      () => current,
      () => {
        state = 'booked'
      },
    )
    current = false
    complete()
    expect((await pending).kind).toBe('stale')
    expect(state).toBe('not booked')
  })
})
