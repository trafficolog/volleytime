import { describe, expect, it } from 'vitest'

import { parseOrgIdFromPath } from './tenant-path'

describe('parseOrgIdFromPath (4.9.12)', () => {
  it('matches org routes regardless of trailing segments', () => {
    expect(parseOrgIdFromPath('/api/organizations/12')).toEqual({ kind: 'org', orgId: 12 })
    expect(parseOrgIdFromPath('/api/organizations/12/members')).toEqual({ kind: 'org', orgId: 12 })
  })
  it('ignores non-org routes (list/create)', () => {
    expect(parseOrgIdFromPath('/api/organizations')).toEqual({ kind: 'none' })
    expect(parseOrgIdFromPath('/api/invites/abc')).toEqual({ kind: 'none' })
  })
  it('rejects non-numeric ids', () => {
    expect(parseOrgIdFromPath('/api/organizations/abc/members')).toEqual({ kind: 'invalid' })
    expect(parseOrgIdFromPath('/api/organizations/0')).toEqual({ kind: 'invalid' })
  })
})
