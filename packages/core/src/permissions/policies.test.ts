import type { OrganizationMember } from '@volley-time/db'
import { describe, expect, it } from 'vitest'

import { ForbiddenError } from './errors'
import {
  canManageContent,
  canManageMembers,
  canInviteRole,
  canManageOrgSettings,
  canModerate,
  requireCanModerate,
  canViewOrgMembers,
  isOrgMember,
  isOrgOwner,
  requireCanManageContent,
  requireOrgMember,
  requireOrgOwner,
} from './policies'

function member(role: string, status: string): OrganizationMember {
  return { role, status } as OrganizationMember
}

describe('permission policies (pure)', () => {
  describe('isOrgMember', () => {
    it('true only for active; pending is an applicant (4.9.7)', () => {
      expect(isOrgMember(member('player', 'active'))).toBe(true)
      expect(isOrgMember(member('player', 'pending'))).toBe(false)
      expect(() => requireOrgMember(member('player', 'pending'))).toThrow(/не одобрена/)
      expect(isOrgMember(member('player', 'blocked'))).toBe(false)
      expect(isOrgMember(null)).toBe(false)
    })
  })

  describe('isOrgOwner', () => {
    it('only active owner', () => {
      expect(isOrgOwner(member('owner', 'active'))).toBe(true)
      expect(isOrgOwner(member('owner', 'blocked'))).toBe(false)
      expect(isOrgOwner(member('organizer', 'active'))).toBe(false)
    })
  })

  describe('canManageContent', () => {
    it('owner and organizer (active) can', () => {
      expect(canManageContent(member('owner', 'active'))).toBe(true)
      expect(canManageContent(member('organizer', 'active'))).toBe(true)
    })
    it('assistant, player, non-active cannot', () => {
      expect(canManageContent(member('assistant', 'active'))).toBe(false)
      expect(canManageContent(member('player', 'active'))).toBe(false)
      expect(canManageContent(member('owner', 'pending'))).toBe(false)
      expect(canManageContent(null)).toBe(false)
    })
  })

  describe('canManageMembers / canViewOrgMembers / canManageOrgSettings', () => {
    it('manage members: owner+organizer', () => {
      expect(canManageMembers(member('organizer', 'active'))).toBe(true)
      expect(canManageMembers(member('player', 'active'))).toBe(false)
    })
    it('view members: any active member', () => {
      expect(canViewOrgMembers(member('player', 'active'))).toBe(true)
      expect(canViewOrgMembers(member('player', 'blocked'))).toBe(false)
    })
    it('org settings: owner only', () => {
      expect(canManageOrgSettings(member('owner', 'active'))).toBe(true)
      expect(canManageOrgSettings(member('organizer', 'active'))).toBe(false)
    })
  })

  describe('permission matrix (ADR 4.3.1, 4.9.6)', () => {
    const owner = { ...member('owner', 'active'), userId: 1 } as OrganizationMember
    const organizer = { ...member('organizer', 'active'), userId: 2 } as OrganizationMember
    const player = { ...member('player', 'active'), userId: 3 } as OrganizationMember
    it('invite roles', () => {
      expect(canInviteRole(owner, 'organizer')).toBe(true)
      expect(canInviteRole(organizer, 'player')).toBe(true)
      expect(canInviteRole(organizer, 'organizer')).toBe(false)
      expect(canInviteRole(organizer, 'assistant')).toBe(false)
      expect(canInviteRole(player, 'player')).toBe(false)
    })
    it('moderation', () => {
      expect(canModerate(owner, organizer)).toBe(true)
      expect(canModerate(organizer, player)).toBe(true)
      expect(canModerate(organizer, { role: 'organizer', userId: 9 })).toBe(false)
      expect(canModerate(organizer, owner)).toBe(false)
      expect(canModerate(organizer, organizer)).toBe(false)
      expect(canModerate(player, { role: 'player', userId: 9 })).toBe(false)
      expect(() => requireCanModerate(organizer, owner)).toThrow(ForbiddenError)
    })
  })

  describe('require* throw ForbiddenError', () => {
    it('requireCanManageContent throws for player', () => {
      expect(() => requireCanManageContent(member('player', 'active'))).toThrow(ForbiddenError)
    })
    it('requireCanManageContent passes for owner', () => {
      expect(() => requireCanManageContent(member('owner', 'active'))).not.toThrow()
    })
    it('requireOrgOwner throws for organizer', () => {
      expect(() => requireOrgOwner(member('organizer', 'active'))).toThrow(ForbiddenError)
    })
  })
})
