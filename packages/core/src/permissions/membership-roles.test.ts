import type { OrganizationMember } from '@volley-time/db'
import { describe, expect, it } from 'vitest'

import {
  canAssignAcceptPayment,
  canCoachEvent,
  canManageContent,
  canManageMembers,
  canSeeEventPayments,
  memberModes,
  memberRoles,
  normalizeRole,
  playModeMember,
} from './policies'

function member(
  role: string,
  opts: { status?: string; canAcceptPayment?: boolean; userId?: number } = {},
): OrganizationMember {
  return {
    role,
    status: opts.status ?? 'active',
    canAcceptPayment: opts.canAcceptPayment ?? false,
    userId: opts.userId ?? 7,
  } as OrganizationMember
}

const event = (coachUserIds: number[]) => ({ coachUserIds })

/** Task 30.1.1 (P-18): роли на членстве, режимы Mini App, роль на событии и флаг оплаты. */
describe('membership roles (pure, 30.1.1)', () => {
  it('reads the legacy assistant value as coach', () => {
    expect(normalizeRole('assistant')).toBe('coach')
    for (const role of ['owner', 'organizer', 'coach', 'player'] as const) {
      expect(normalizeRole(role)).toBe(role)
    }
  })

  it('every role also plays; plain players have only player', () => {
    expect(memberRoles(member('owner'))).toEqual(['owner', 'player'])
    expect(memberRoles(member('organizer'))).toEqual(['organizer', 'player'])
    expect(memberRoles(member('coach'))).toEqual(['coach', 'player'])
    expect(memberRoles(member('assistant'))).toEqual(['coach', 'player'])
    expect(memberRoles(member('player'))).toEqual(['player'])
  })

  it('modes: owner and organizer manage, coach leads, player has no switcher', () => {
    expect(memberModes(member('owner'))).toEqual(['play', 'manage'])
    expect(memberModes(member('organizer'))).toEqual(['play', 'manage'])
    expect(memberModes(member('coach'))).toEqual(['play', 'coach'])
    expect(memberModes(member('player'))).toEqual(['play'])
  })

  it('a coach does not manage content or members', () => {
    expect(canManageContent(member('coach'))).toBe(false)
    expect(canManageMembers(member('coach'))).toBe(false)
    expect(canManageContent(member('assistant'))).toBe(false)
  })

  it('event role: managers and the event coaches, not other coaches or players', () => {
    expect(canCoachEvent(member('owner'), event([]))).toBe(true)
    expect(canCoachEvent(member('organizer'), event([]))).toBe(true)
    expect(canCoachEvent(member('coach', { userId: 7 }), event([7]))).toBe(true)
    expect(canCoachEvent(member('assistant', { userId: 7 }), event([7]))).toBe(true)
    expect(canCoachEvent(member('coach', { userId: 7 }), event([8]))).toBe(false)
    // игрок, оказавшийся в списке тренеров (например, после смены роли), прав тренера не получает
    expect(canCoachEvent(member('player', { userId: 7 }), event([7]))).toBe(false)
    expect(canCoachEvent(member('coach', { userId: 7, status: 'blocked' }), event([7]))).toBe(false)
    expect(canCoachEvent(null, event([7]))).toBe(false)
  })

  it('payments: managers; a coach only with the flag and only on own events', () => {
    expect(canSeeEventPayments(member('organizer'), event([]))).toBe(true)
    expect(canSeeEventPayments(member('coach', { userId: 7 }), event([7]))).toBe(false)
    expect(
      canSeeEventPayments(member('coach', { userId: 7, canAcceptPayment: true }), event([7])),
    ).toBe(true)
    expect(
      canSeeEventPayments(member('coach', { userId: 7, canAcceptPayment: true }), event([8])),
    ).toBe(false)
    // флаг у не-тренера ничего не даёт
    expect(
      canSeeEventPayments(member('player', { userId: 7, canAcceptPayment: true }), event([7])),
    ).toBe(false)
  })

  it('the payment flag is granted by the owner or an organizer', () => {
    expect(canAssignAcceptPayment(member('owner'))).toBe(true)
    expect(canAssignAcceptPayment(member('organizer'))).toBe(true)
    expect(canAssignAcceptPayment(member('coach'))).toBe(false)
    expect(canAssignAcceptPayment(member('player'))).toBe(false)
    expect(canAssignAcceptPayment(member('organizer', { status: 'pending' }))).toBe(false)
  })

  it('play mode turns any member into a plain player without payment access', () => {
    const played = playModeMember(member('organizer', { canAcceptPayment: true }))!
    expect(played.role).toBe('player')
    expect(played.canAcceptPayment).toBe(false)
    expect(canManageContent(played)).toBe(false)
    expect(playModeMember(null)).toBeNull()
  })
})
