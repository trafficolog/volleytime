import { describe, expect, it } from 'vitest'

import { subscriptionUiState } from './subscription-availability'

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
