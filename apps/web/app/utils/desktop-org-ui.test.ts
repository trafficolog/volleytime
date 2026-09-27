import { describe, expect, it } from 'vitest'

import {
  desktopNavItems,
  desktopSignInPath,
  isLiveDesktopRoute,
  resolveDesktopOrgAccess,
  shouldShowDesktopOrgLoading,
} from './desktop-org-ui'

const org = { id: 7, status: 'active' }
const owner = { role: 'owner', status: 'active' }

describe('desktop organization entry', () => {
  it('stops loading when an empty response completes, while withholding stale group data', () => {
    expect(shouldShowDesktopOrgLoading(true, null, 7)).toBe(true)
    expect(shouldShowDesktopOrgLoading(false, null, 7)).toBe(false)
    expect(shouldShowDesktopOrgLoading(false, 8, 7)).toBe(true)
    expect(shouldShowDesktopOrgLoading(false, 7, 7)).toBe(false)
  })

  it('allows only the active owner or organizer of the requested group', () => {
    expect(resolveDesktopOrgAccess(org, owner, 7)).toBe('ready')
    expect(resolveDesktopOrgAccess(org, { role: 'organizer', status: 'active' }, 7)).toBe('ready')
    expect(resolveDesktopOrgAccess(org, { role: 'player', status: 'active' }, 7)).toBe('denied')
    expect(resolveDesktopOrgAccess(org, { role: 'assistant', status: 'active' }, 7)).toBe('denied')
    expect(resolveDesktopOrgAccess(org, { role: 'owner', status: 'pending' }, 7)).toBe('denied')
    expect(resolveDesktopOrgAccess(org, owner, 8)).toBe('denied')
  })

  it('distinguishes login, suspension and service errors without exposing the shell', () => {
    expect(resolveDesktopOrgAccess(null, null, 7, 401)).toBe('login')
    expect(resolveDesktopOrgAccess(null, null, 7, 403, 'organization.suspended')).toBe('suspended')
    expect(resolveDesktopOrgAccess(null, null, 7, 410, 'organization.archived')).toBe('archived')
    expect(resolveDesktopOrgAccess({ id: 7, status: 'suspended' }, owner, 7)).toBe('suspended')
    expect(resolveDesktopOrgAccess({ id: 7, status: 'archived' }, owner, 7)).toBe('archived')
    expect(resolveDesktopOrgAccess(null, null, 7, 403)).toBe('denied')
    expect(resolveDesktopOrgAccess(null, null, 7, 503)).toBe('error')
    expect(resolveDesktopOrgAccess(null, null, 7)).toBe('error')
  })
})

describe('desktop navigation', () => {
  it('keeps a safe local return path for email sign-in', () => {
    expect(desktopSignInPath('/app/orgs/7/events')).toBe(
      '/auth/login?redirect=%2Fapp%2Forgs%2F7%2Fevents',
    )
    expect(desktopSignInPath('/m/orgs/7')).toBe('/auth/login')
  })

  it('hides plans only while subscriptions are disabled', () => {
    expect(desktopNavItems(7, true).map((item) => item.key)).toEqual([
      'overview',
      'events',
      'members',
      'plans',
      'settings',
    ])
    expect(desktopNavItems(7, false).map((item) => item.key)).toEqual([
      'overview',
      'events',
      'members',
      'settings',
    ])
    expect(desktopNavItems(7, false)[0]?.to).toBe('/app/orgs/7')
  })

  it('rejects a mutation after route or organization changes', () => {
    expect(isLiveDesktopRoute('/app/orgs/7/events/9', '/app/orgs/7/events/9')).toBe(true)
    expect(isLiveDesktopRoute('/app/orgs/7/events/9/edit', '/app/orgs/7/events/9')).toBe(false)
    expect(isLiveDesktopRoute('/app/orgs/8', '/app/orgs/7')).toBe(false)
  })
})
