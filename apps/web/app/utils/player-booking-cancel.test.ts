import { describe, expect, it } from 'vitest'

import {
  CANCEL_REFUND_NOTE,
  cancelConfirmText,
  cancelMayReleasePaidSeats,
  SUBSCRIPTION_RETURN_NOTE,
  seatsCancelConfirmText,
  sessionReturnsOnCancel,
} from './player-booking-cancel'

describe('player booking cancellation copy and seats', () => {
  it('uses the same D-14 sentence as the bot and the organizer roster', () => {
    expect(CANCEL_REFUND_NOTE).toBe(
      'Оплаченные места освободятся без возврата денег: возврат — отдельное действие организатора.',
    )
  })

  it('warns only for bookings paid in cash or by transfer', () => {
    expect(cancelMayReleasePaidSeats('cash')).toBe(true)
    expect(cancelMayReleasePaidSeats('transfer')).toBe(true)
    expect(cancelMayReleasePaidSeats('free')).toBe(false)
    expect(cancelMayReleasePaidSeats('subscription')).toBe(false)
    expect(cancelMayReleasePaidSeats(null)).toBe(false)
  })

  it('appends the refund note to the cancel question for paid bookings only', () => {
    expect(cancelConfirmText('Отменить запись?', 'cash')).toBe(
      `Отменить запись? ${CANCEL_REFUND_NOTE}`,
    )
    expect(cancelConfirmText('Отменить запись?', 'free')).toBe('Отменить запись?')
  })

  it('describes the partial cancellation with the removed and kept seats', () => {
    expect(seatsCancelConfirmText(1, 2, 'free')).toBe('Снять 1 место? Останется 2 места.')
    expect(seatsCancelConfirmText(2, 1, 'transfer')).toBe(
      `Снять 2 места? Останется 1 место. ${CANCEL_REFUND_NOTE}`,
    )
  })

  describe('session return caption for subscription bookings', () => {
    const sub = { status: 'confirmed', method: 'subscription', paymentId: null }

    it('uses the owner-approved wording', () => {
      expect(SUBSCRIPTION_RETURN_NOTE).toBe('Занятие вернётся на абонемент')
    })

    it('promises the return for a confirmed subscription booking on a fixed-price event', () => {
      expect(sessionReturnsOnCancel(sub, 'fixed')).toBe(true)
    })

    it('does not promise it when no session was spent or the seat was paid otherwise', () => {
      expect(sessionReturnsOnCancel({ ...sub, status: 'waitlisted' }, 'fixed')).toBe(false)
      expect(sessionReturnsOnCancel({ ...sub, status: 'pending_payment' }, 'fixed')).toBe(false)
      expect(sessionReturnsOnCancel({ ...sub, paymentId: 9 }, 'fixed')).toBe(false)
      expect(sessionReturnsOnCancel(sub, 'split')).toBe(false)
    })

    it('does not promise it for other payment methods', () => {
      for (const method of ['cash', 'transfer', 'free'])
        expect(sessionReturnsOnCancel({ ...sub, method }, 'fixed')).toBe(false)
    })
  })
})
