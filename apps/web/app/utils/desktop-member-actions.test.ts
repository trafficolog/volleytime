import { describe, expect, it } from 'vitest'

import { desktopMemberActions } from './desktop-member-actions'

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
