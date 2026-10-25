import { describe, expect, it } from 'vitest'

import {
  CANCEL_REFUND_NOTE,
  cancelConfirmText,
  cancelMayReleasePaidSeats,
  partialCancelTargets,
  seatsCancelConfirmText,
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

  it('lists the kept seat counts from one to total minus one', () => {
    expect(partialCancelTargets(1)).toEqual([])
    expect(partialCancelTargets(2)).toEqual([1])
    expect(partialCancelTargets(4)).toEqual([1, 2, 3])
  })

  it('describes the partial cancellation with the removed and kept seats', () => {
    expect(seatsCancelConfirmText(1, 2, 'free')).toBe('Снять 1 место? Останется 2 места.')
    expect(seatsCancelConfirmText(2, 1, 'transfer')).toBe(
      `Снять 2 места? Останется 1 место. ${CANCEL_REFUND_NOTE}`,
    )
  })
})
