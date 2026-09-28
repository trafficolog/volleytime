import { describe, expect, it } from 'vitest'

import {
  canSubmitSubscriptionPurchase,
  subscriptionHistoryLabel,
  subscriptionSections,
  subscriptionUiState,
} from './subscription-availability'

const active = {
  organizationId: 1,
  status: 'active',
  usedSessions: 3,
  totalSessions: 8,
  expiresAt: null,
}
const unavailable = {
  showMenu: false,
  allowPurchase: false,
  allowBooking: false,
  readOnly: false,
}

describe('selected organization subscription availability', () => {
  it('shows purchase and booking when enabled even without a balance', () => {
    expect(subscriptionUiState(true, 1, [])).toEqual({
      showMenu: true,
      allowPurchase: true,
      allowBooking: true,
      readOnly: false,
    })
  })

  it('shows an active balance read-only when disabled', () => {
    expect(subscriptionUiState(false, 1, [active])).toEqual({
      showMenu: true,
      allowPurchase: false,
      allowBooking: false,
      readOnly: true,
    })
  })

  it('hides the entry without an active, positive, unexpired balance', () => {
    const now = new Date('2026-09-24T12:00:00Z')
    const invalid = [
      { ...active, status: 'pending' },
      { ...active, status: 'exhausted' },
      { ...active, usedSessions: 8 },
      { ...active, expiresAt: '2026-09-24T11:59:59Z' },
      { ...active, expiresAt: '2026-09-24T12:00:00Z' },
    ]
    for (const sub of invalid)
      expect(subscriptionUiState(false, 1, [sub], now)).toEqual(unavailable)
  })

  it('does not leak another organization balance into the selected group', () => {
    expect(subscriptionUiState(false, 2, [active])).toEqual(unavailable)
  })

  it('never enables actions while the organization setting is unknown', () => {
    expect(subscriptionUiState(null, 1, [])).toEqual(unavailable)
    expect(subscriptionUiState(null, 1, [active])).toEqual({
      showMenu: true,
      allowPurchase: false,
      allowBooking: false,
      readOnly: true,
    })
  })
})

describe('subscription page state', () => {
  const now = new Date('2026-09-24T12:00:00Z')

  it('puts only usable active balances and pending purchases above history', () => {
    const records = [
      { ...active, id: 1 },
      { ...active, id: 2, status: 'pending' },
      { ...active, id: 3, usedSessions: 8 },
      { ...active, id: 4, expiresAt: '2026-09-24T11:59:59Z' },
      { ...active, id: 5, organizationId: 2 },
    ]
    const sections = subscriptionSections(1, records, now)

    expect(sections.active.map((record) => record.id)).toEqual([1])
    expect(sections.pending.map((record) => record.id)).toEqual([2])
    expect(sections.history.map((record) => record.id)).toEqual([3, 4])
  })

  it('blocks buying when the setting changed, the route changed, or a submit is in flight', () => {
    const plan = { id: 7, organizationId: 1, status: 'active' }
    expect(canSubmitSubscriptionPurchase(1, true, false, plan)).toBe(true)
    expect(canSubmitSubscriptionPurchase(1, false, false, plan)).toBe(false)
    expect(canSubmitSubscriptionPurchase(2, true, false, plan)).toBe(false)
    expect(canSubmitSubscriptionPurchase(1, true, true, plan)).toBe(false)
    expect(canSubmitSubscriptionPurchase(1, true, false, { ...plan, status: 'archived' })).toBe(
      false,
    )
    expect(canSubmitSubscriptionPurchase(1, true, false, null)).toBe(false)
  })

  it('labels expired and exhausted active records as history rather than usable balance', () => {
    expect(subscriptionHistoryLabel({ ...active, usedSessions: 8 }, now)).toBe('Использован')
    expect(subscriptionHistoryLabel({ ...active, expiresAt: '2026-09-24T12:00:00Z' }, now)).toBe(
      'Истёк',
    )
    expect(subscriptionHistoryLabel({ ...active, status: 'cancelled' }, now)).toBe('Отменён')
  })
})
