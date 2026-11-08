import { describe, expect, it } from 'vitest'

import {
  canBlockExcludedMember,
  canExcludeMember,
  desktopMemberActions,
} from './desktop-member-actions'

const owner = { role: 'owner' as const, status: 'active' as const, userId: 1 }
const organizer = { role: 'organizer' as const, status: 'active' as const, userId: 2 }
const player = { role: 'player' as const, status: 'active' as const, userId: 3 }

describe('desktop member actions', () => {
  it('mirrors moderation rights and status transitions', () => {
    expect(desktopMemberActions(organizer, { role: 'owner', status: 'active', userId: 1 })).toEqual(
      [],
    )
    expect(
      desktopMemberActions(organizer, { role: 'organizer', status: 'active', userId: 4 }),
    ).toEqual([])
    expect(
      desktopMemberActions(organizer, { role: 'assistant', status: 'pending', userId: 4 }),
    ).toEqual(['approve', 'reject', 'block'])
    expect(
      desktopMemberActions(organizer, { role: 'player', status: 'blocked', userId: 4 }),
    ).toEqual(['unblock'])
    expect(desktopMemberActions(player, { role: 'player', status: 'active', userId: 4 })).toEqual(
      [],
    )
    expect(
      desktopMemberActions(
        { ...organizer, status: 'pending' },
        { role: 'player', status: 'active', userId: 4 },
      ),
    ).toEqual([])
  })

  it('allows role changes only for owner and never for self or owner target', () => {
    expect(desktopMemberActions(owner, { role: 'organizer', status: 'active', userId: 4 })).toEqual(
      ['block', 'changeRole'],
    )
    expect(desktopMemberActions(owner, { role: 'player', status: 'active', userId: 1 })).toEqual([])
    expect(desktopMemberActions(owner, { role: 'owner', status: 'active', userId: 4 })).toEqual([])
    expect(
      desktopMemberActions(organizer, { role: 'player', status: 'active', userId: 4 }),
    ).toEqual(['block'])
  })
})

describe('canExcludeMember (21.2.21)', () => {
  const assistant = { role: 'assistant' as const, status: 'active' as const, userId: 5 }
  const target = (
    role: 'owner' | 'organizer' | 'assistant' | 'player',
    status: string,
    userId = 4,
  ) => ({ role, status, userId })

  it('never offers the owner or yourself', () => {
    expect(canExcludeMember(organizer, target('owner', 'active', 1))).toBe(false)
    expect(canExcludeMember(owner, target('owner', 'active', 9))).toBe(false)
    expect(canExcludeMember(owner, target('player', 'active', 1))).toBe(false)
    expect(canExcludeMember(organizer, target('player', 'active', 2))).toBe(false)
  })

  it('lets only the owner exclude admins; an organizer excludes players', () => {
    expect(canExcludeMember(owner, target('organizer', 'active'))).toBe(true)
    expect(canExcludeMember(owner, target('assistant', 'active'))).toBe(true)
    expect(canExcludeMember(organizer, target('organizer', 'active'))).toBe(false)
    expect(canExcludeMember(organizer, target('assistant', 'active'))).toBe(false)
    expect(canExcludeMember(organizer, target('player', 'active'))).toBe(true)
  })

  it('needs a manager actor and an active or guest target', () => {
    expect(canExcludeMember(assistant, target('player', 'active'))).toBe(false)
    expect(canExcludeMember(player, target('player', 'active'))).toBe(false)
    expect(canExcludeMember(null, target('player', 'active'))).toBe(false)
    expect(canExcludeMember({ ...owner, status: 'pending' }, target('player', 'active'))).toBe(
      false,
    )
    for (const status of ['pending', 'blocked', 'left', 'rejected']) {
      expect(canExcludeMember(owner, target('player', status))).toBe(false)
    }
    expect(canExcludeMember(owner, target('player', 'guest'))).toBe(true)
  })
})

describe('canBlockExcludedMember (21.2.24)', () => {
  const t = (
    role: 'owner' | 'organizer' | 'assistant' | 'player',
    status = 'left',
    userId = 4,
  ) => ({
    role,
    status,
    userId,
  })
  it('lets the owner block any excluded non-owner; an organizer only players', () => {
    expect(canBlockExcludedMember(owner, t('organizer'))).toBe(true)
    expect(canBlockExcludedMember(owner, t('assistant'))).toBe(true)
    expect(canBlockExcludedMember(organizer, t('player'))).toBe(true)
    expect(canBlockExcludedMember(organizer, t('assistant'))).toBe(false)
    expect(canBlockExcludedMember(organizer, t('organizer'))).toBe(false)
  })
  it('refuses owner, self, non-left targets and non-managers', () => {
    expect(canBlockExcludedMember(owner, t('owner'))).toBe(false)
    expect(canBlockExcludedMember(owner, t('player', 'left', 1))).toBe(false)
    expect(canBlockExcludedMember(owner, t('player', 'active'))).toBe(false)
    expect(canBlockExcludedMember(player, t('player'))).toBe(false)
    expect(canBlockExcludedMember(null, t('player'))).toBe(false)
  })
})
