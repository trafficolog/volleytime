import { describe, expect, it } from 'vitest'

import {
  inviteDestination,
  inviteScreenState,
  playerGroupEntry,
  playerGroupsEmpty,
} from './player-onboarding'

describe('player group onboarding', () => {
  it('shows invite and create actions when no groups exist', () => {
    expect(playerGroupsEmpty([])).toEqual({ empty: true, invite: true, create: true })
  })

  it('keeps pending and suspended groups informational without selecting them', () => {
    const active = playerGroupEntry({ id: 1, status: 'active', membershipStatus: 'active' })
    const pending = playerGroupEntry({ id: 2, status: 'active', membershipStatus: 'pending' })
    const suspended = playerGroupEntry({ id: 3, status: 'suspended', membershipStatus: 'active' })

    expect(active).toEqual({ to: '/m/orgs/1', selectable: true, label: null })
    expect(pending).toEqual({ to: '/m/orgs/2', selectable: false, label: 'Заявка на рассмотрении' })
    expect(suspended).toEqual({
      to: '/m/orgs/3',
      selectable: false,
      label: 'Группа приостановлена',
    })
  })

  it('accepts valid invite input and leaves invalid input on the form', () => {
    expect(inviteDestination('https://t.me/volleytime_bot?start=org_Tok_12345')).toBe(
      '/m/invite/Tok_12345',
    )
    expect(inviteDestination('привет')).toBeNull()
  })
})

describe('invite preview state', () => {
  it('allows redeem only for a valid invitation without an existing membership', () => {
    expect(
      inviteScreenState(
        'token-a',
        { status: 'valid', organization: { id: 1 }, myMembership: null },
        null,
      ),
    ).toBe('invite')
    expect(
      inviteScreenState(
        'token-a',
        { status: 'valid', organization: { id: 1 }, myMembership: { status: 'pending' } },
        null,
      ),
    ).toBe('applied')
    expect(
      inviteScreenState(
        'token-a',
        { status: 'valid', organization: { id: 1 }, myMembership: { status: 'active' } },
        null,
      ),
    ).toBe('member')
  })

  it('explains revoked, expired and blocked states rather than allowing redeem', () => {
    expect(inviteScreenState('token-a', { status: 'revoked', myMembership: null }, null)).toBe(
      'invalid',
    )
    expect(inviteScreenState('token-a', { status: 'expired', myMembership: null }, null)).toBe(
      'invalid',
    )
    expect(
      inviteScreenState(
        'token-a',
        { status: 'valid', organization: { id: 1 }, myMembership: { status: 'blocked' } },
        null,
      ),
    ).toBe('blocked')
  })

  it('does not carry the joined state from token A into token B', () => {
    const joined = { token: 'token-a', status: 'pending' as const }
    expect(
      inviteScreenState(
        'token-a',
        { status: 'valid', organization: { id: 1 }, myMembership: null },
        joined,
      ),
    ).toBe('applied')
    expect(
      inviteScreenState(
        'token-b',
        { status: 'valid', organization: { id: 2 }, myMembership: null },
        joined,
      ),
    ).toBe('invite')
  })
})
