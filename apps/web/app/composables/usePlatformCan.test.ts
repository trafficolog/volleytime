import { PLATFORM_ROLES } from '@volley-time/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { usePlatformCan } from './usePlatformCan'

import { stubPlatformStaff } from '~/test-support/platform-staff'

afterEach(() => vi.unstubAllGlobals())

describe('usePlatformCan: кнопки изменений по политикам staff/me (29.3.1, R-15)', () => {
  it('роль из политики проходит, остальные нет', () => {
    stubPlatformStaff('finance')
    const { can } = usePlatformCan()
    expect(can('balanceManage')).toBe(true)
    expect(can('plansManage')).toBe(false)
    expect(can('groupPagesModerate')).toBe(false)
  })

  it('Owner проходит каждую политику, Analyst — ни одну политику изменений', () => {
    stubPlatformStaff('owner')
    expect(usePlatformCan().can('team')).toBe(true)
    stubPlatformStaff('analyst')
    const { can } = usePlatformCan()
    for (const policy of [
      'organizationsManage',
      'usersManage',
      'balanceManage',
      'plansManage',
      'subscriptionsManage',
      'groupPagesModerate',
      'groupPageComplaintsResolve',
      'groupPageComplaintsReject',
      'organizationEnter',
    ] as const) {
      expect(can(policy)).toBe(false)
    }
    expect(PLATFORM_ROLES).toContain('analyst')
  })

  it('пока роль грузится — кнопок нет', () => {
    stubPlatformStaff('pending')
    expect(usePlatformCan().can('overview')).toBe(false)
  })

  it('при ошибке staff/me — кнопок нет', () => {
    stubPlatformStaff('error')
    expect(usePlatformCan().can('organizationsManage')).toBe(false)
  })
})
