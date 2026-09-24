import { describe, expect, it } from 'vitest'

import { resolveOrganizerEntry, safeAuthRedirect, type AuthOrg } from './auth-destination'

const org = (overrides: Partial<AuthOrg> = {}): AuthOrg => ({
  id: 7,
  name: 'Команда',
  status: 'active',
  membershipRole: 'owner',
  membershipStatus: 'active',
  ...overrides,
})

describe('organizer entry policy', () => {
  it('keeps non-organizers and pending memberships outside the organizer cabinet', () => {
    expect(resolveOrganizerEntry([])).toEqual({ kind: 'none' })
    expect(resolveOrganizerEntry([org({ membershipRole: 'player' })])).toEqual({ kind: 'none' })
    expect(resolveOrganizerEntry([org({ membershipRole: 'assistant' })])).toEqual({ kind: 'none' })
    expect(resolveOrganizerEntry([org({ membershipStatus: 'pending' })])).toEqual({ kind: 'none' })
    expect(resolveOrganizerEntry([org({ status: 'archived' })])).toEqual({ kind: 'none' })
  })

  it('opens the only active organizer organization', () => {
    expect(resolveOrganizerEntry([org()])).toEqual({ kind: 'open', org: org() })
  })

  it('explains a sole suspended organizer organization', () => {
    expect(resolveOrganizerEntry([org({ status: 'suspended' })])).toEqual({
      kind: 'blocked',
      org: org({ status: 'suspended' }),
    })
  })

  it('offers a choice across active and suspended organizer organizations only', () => {
    expect(
      resolveOrganizerEntry([
        org(),
        org({ id: 8, name: 'Вторая', status: 'suspended', membershipRole: 'organizer' }),
        org({ id: 9, membershipRole: 'player' }),
      ]),
    ).toEqual({
      kind: 'choose',
      orgs: [
        org(),
        org({ id: 8, name: 'Вторая', status: 'suspended', membershipRole: 'organizer' }),
      ],
    })
  })
})

describe('post-login redirect', () => {
  it.each([
    '//evil.test',
    '/%2f/evil.test',
    '/\\evil.test',
    'https://evil.test',
    '/auth/login',
    '/m/%5cevil.test',
    '/m/%2f%2fevil.test',
    '/m/%252f%252fevil.test',
    '/m/%00bad',
  ])('rejects ambiguous or external redirect %s', (value) => {
    expect(safeAuthRedirect(value)).toBeNull()
  })

  it('preserves a local Mini App invitation and rejects non-string query values', () => {
    expect(safeAuthRedirect('/m/invite/abc')).toBe('/m/invite/abc')
    expect(safeAuthRedirect(['/m/invite/abc'])).toBeNull()
  })
})
