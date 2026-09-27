import { describe, expect, it } from 'vitest'

import { groupEntryState, visibleGroup } from './group-entry-state'

describe('group entry denial', () => {
  it('distinguishes suspended organization from other access denial', () => {
    expect(groupEntryState(403, 'organization.suspended')).toBe('suspended')
    expect(groupEntryState(403, 'permission.blocked')).toBe('denied')
    expect(groupEntryState(403, 'permission.not_member')).toBe('denied')
  })

  it('does not call missing, offline, or server failures an access denial', () => {
    expect(groupEntryState(401, undefined)).toBe('unauthorized')
    expect(groupEntryState(404, undefined)).toBe('error')
    expect(groupEntryState(500, undefined)).toBe('error')
    expect(groupEntryState(undefined, undefined)).toBe('error')
  })

  it('hides a stale organization whenever its current request failed', () => {
    const stale = { id: 7, name: 'Закрытая группа' }
    expect(visibleGroup(stale, { statusCode: 403 }, 7)).toBeNull()
    expect(visibleGroup(stale, null, 7)).toEqual(stale)
    expect(visibleGroup(stale, null, 8)).toBeNull()
    expect(visibleGroup(null, null, 7)).toBeNull()
  })
})
