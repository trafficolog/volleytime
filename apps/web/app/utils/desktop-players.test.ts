import { describe, expect, it } from 'vitest'

import {
  canAssignLevelTo,
  countPlayerTabs,
  filterPlayers,
  pickPlayerInvite,
  playersSubtitle,
  pluralRu,
  telegramChatUrl,
} from './desktop-players'

import type { MemberRow } from '~/composables/useOrganizations'

function row(
  id: number,
  status: MemberRow['status'],
  extra: { level?: string | null; username?: string | null } = {},
): MemberRow {
  return {
    id,
    organizationId: 1,
    role: 'player',
    status,
    level: extra.level ?? null,
    joinedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    user: {
      id: id + 100,
      name: `Игрок ${id}`,
      telegramUsername: extra.username ?? null,
      image: null,
    },
  }
}

const members = [
  row(1, 'active', { level: 'v2', username: 'alpha_user' }),
  row(2, 'active', { level: 'v3' }),
  row(3, 'pending'),
  row(4, 'guest'),
  row(5, 'blocked'),
  row(6, 'left'),
  row(7, 'rejected'),
]

describe('desktop players list', () => {
  it('counts tabs from one list and ignores left/rejected', () => {
    expect(countPlayerTabs(members)).toEqual({
      all: 5,
      active: 2,
      pending: 1,
      guest: 1,
      blocked: 1,
      excluded: 0,
    })
  })

  it('builds the subtitle with plural forms and skips empty parts', () => {
    expect(playersSubtitle(countPlayerTabs(members))).toBe(
      '2 активных · 1 на модерации · 1 заблокирован',
    )
    expect(
      playersSubtitle({ all: 0, active: 0, pending: 0, guest: 0, blocked: 0, excluded: 0 }),
    ).toBe('0 активных')
    expect(pluralRu(21, 'a', 'b', 'c')).toBe('a')
    expect(pluralRu(12, 'a', 'b', 'c')).toBe('c')
    expect(pluralRu(3, 'a', 'b', 'c')).toBe('b')
  })

  it('filters by tab, search (name or @username) and level', () => {
    const f = (tab: 'all' | 'active' | 'guest', query = '', level = 'all') =>
      filterPlayers(members, { tab, query, level }).map((m) => m.id)
    expect(f('all')).toEqual([1, 2, 3, 4, 5])
    expect(f('guest')).toEqual([4])
    expect(f('all', '@ALPHA')).toEqual([1])
    expect(f('all', 'игрок 2')).toEqual([2])
    expect(f('active', '', 'v3')).toEqual([2])
    expect(f('all', '', 'none')).toEqual([3, 4, 5])
  })

  it('assigns levels only to pending, active and guest', () => {
    expect(['pending', 'active', 'guest'].every(canAssignLevelTo)).toBe(true)
    expect(['blocked', 'left', 'rejected'].some(canAssignLevelTo)).toBe(false)
  })

  it('builds a t.me link only for a valid username', () => {
    expect(telegramChatUrl('alpha_user')).toBe('https://t.me/alpha_user')
    expect(telegramChatUrl(null)).toBeNull()
    expect(telegramChatUrl('a b')).toBeNull()
    expect(telegramChatUrl('x/../y')).toBeNull()
  })

  it('reuses only an unlimited general player invite with the default member status', () => {
    const base = {
      roleToAssign: 'player',
      type: 'organization_join',
      defaultMemberStatus: 'active',
      isRevoked: false,
      expiresAt: null,
      maxUses: null,
      usesCount: 0,
      deeplinkUrl: 'https://t.me/bot?start=x',
    }
    const skipped = [
      { ...base, roleToAssign: 'organizer' },
      { ...base, isRevoked: true },
      { ...base, expiresAt: '2000-01-01T00:00:00Z' },
      { ...base, maxUses: 1 },
      { ...base, maxUses: 50, usesCount: 3 },
      { ...base, maxUses: 2, usesCount: 2 },
      { ...base, defaultMemberStatus: 'pending' },
      { ...base, type: 'event_join' },
    ]
    expect(pickPlayerInvite(skipped, 'active')).toBeNull()
    const ok = { ...base, deeplinkUrl: 'https://t.me/bot?start=ok' }
    expect(pickPlayerInvite([...skipped, ok], 'active')?.deeplinkUrl).toBe(ok.deeplinkUrl)
    expect(pickPlayerInvite([ok], 'pending')).toBeNull()
  })
})
