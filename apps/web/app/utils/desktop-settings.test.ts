import { describe, expect, it } from 'vitest'

import { canSaveDesktopSettings } from './desktop-settings'
import { organizationSettingsPayload } from './organization-settings-payload'

describe('desktop settings boundary', () => {
  const path = '/app/orgs/7/settings'
  const owner = { role: 'owner', status: 'active' }

  it('allows only an active owner on the live, idle route', () => {
    expect(canSaveDesktopSettings(owner, path, path, false)).toBe(true)
    expect(canSaveDesktopSettings({ role: 'organizer', status: 'active' }, path, path, false)).toBe(
      false,
    )
    expect(canSaveDesktopSettings({ role: 'owner', status: 'pending' }, path, path, false)).toBe(
      false,
    )
    expect(canSaveDesktopSettings(owner, '/app/orgs/8/settings', path, false)).toBe(false)
    expect(canSaveDesktopSettings(owner, path, path, true)).toBe(false)
  })

  it('only sends the subscription toggle when explicitly changed', () => {
    const form = {
      name: 'Группа',
      city: '',
      description: '',
      defaultMemberStatus: 'active' as const,
      subscriptionsEnabled: false,
    }
    expect(organizationSettingsPayload(form, true)).toMatchObject({ subscriptionsEnabled: false })
    expect(organizationSettingsPayload(form, false)).not.toHaveProperty('subscriptionsEnabled')
  })
})
