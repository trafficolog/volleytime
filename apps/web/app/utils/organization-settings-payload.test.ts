import { describe, expect, it } from 'vitest'

import { organizationSettingsPayload } from './organization-settings-payload'

const form = {
  name: 'Club renamed',
  city: 'Минск',
  description: '',
  defaultMemberStatus: 'active' as const,
  subscriptionsEnabled: true,
}

describe('organization settings payload', () => {
  it('does not re-enable subscriptions from a stale form when only other fields changed', () => {
    expect(organizationSettingsPayload(form, true)).toEqual({
      name: 'Club renamed',
      city: 'Минск',
      description: null,
      defaultMemberStatus: 'active',
    })
  })

  it('sends an explicitly changed subscription setting in either direction', () => {
    expect(organizationSettingsPayload({ ...form, subscriptionsEnabled: false }, true)).toEqual({
      name: 'Club renamed',
      city: 'Минск',
      description: null,
      defaultMemberStatus: 'active',
      subscriptionsEnabled: false,
    })
    expect(organizationSettingsPayload(form, false)).toMatchObject({
      subscriptionsEnabled: true,
    })
  })
})
