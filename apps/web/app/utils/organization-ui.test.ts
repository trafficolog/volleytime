import { describe, expect, it } from 'vitest'

import {
  auditActionLabel,
  auditEntityLabel,
  canManageOrgSettingsUi,
  canViewOrgAuditUi,
} from './organization-ui'

describe('organization UI policy', () => {
  it('allows audit only to active owner and organizer', () => {
    expect(canViewOrgAuditUi({ role: 'owner', status: 'active' })).toBe(true)
    expect(canViewOrgAuditUi({ role: 'organizer', status: 'active' })).toBe(true)
    expect(canViewOrgAuditUi({ role: 'assistant', status: 'active' })).toBe(false)
    expect(canViewOrgAuditUi({ role: 'player', status: 'active' })).toBe(false)
    expect(canViewOrgAuditUi({ role: 'owner', status: 'pending' })).toBe(false)
  })

  it('allows organization settings only to the active owner', () => {
    expect(canManageOrgSettingsUi({ role: 'owner', status: 'active' })).toBe(true)
    expect(canManageOrgSettingsUi({ role: 'organizer', status: 'active' })).toBe(false)
    expect(canManageOrgSettingsUi({ role: 'owner', status: 'pending' })).toBe(false)
  })

  it('renders audit labels with safe fallbacks', () => {
    expect(auditActionLabel('organization.archived')).toBe('Организация архивирована')
    expect(auditActionLabel('custom.action')).toBe('custom.action')
    expect(auditEntityLabel('member')).toBe('Участник')
    expect(auditEntityLabel('custom')).toBe('custom')
  })
})
