import { describe, expect, it } from 'vitest'

import { buildMiniAppUrl, buildStartMessage } from './start'

describe('buildStartMessage', () => {
  it('default greeting without deeplink', () => {
    const msg = buildStartMessage('Иван', undefined)
    expect(msg).toContain('Иван')
    expect(msg).toContain('платформа')
  })

  it('invite message for org_ deeplink', () => {
    const msg = buildStartMessage('Иван', 'org_tok')
    expect(msg).toContain('пригласили в организацию')
  })

  it('event message for event_ deeplink', () => {
    const msg = buildStartMessage('Иван', 'event_5')
    expect(msg).toContain('событие')
  })
})

describe('invite context in /start (8.8.10)', () => {
  it('shows group name and inviter', () => {
    const text = buildStartMessage('Иван', 'org_abc', {
      status: 'valid',
      organizationName: 'VolleyTime Минск',
      membersCount: 14,
      inviterName: 'Пётр',
    })
    expect(text).toContain('VolleyTime Минск')
    expect(text).toContain('Пётр')
    expect(text).toContain('14')
  })

  it('explains why the invite is invalid', () => {
    const text = buildStartMessage('Иван', 'org_abc', {
      status: 'expired',
      organizationName: null,
      membersCount: 0,
      inviterName: null,
    })
    expect(text).toContain('Срок действия')
  })

  it('falls back to generic text without preview', () => {
    expect(buildStartMessage('Иван', 'org_abc', null)).toContain('пригласили')
  })
})

describe('buildMiniAppUrl', () => {
  it('plain /m/ without deeplink', () => {
    expect(buildMiniAppUrl(undefined)).toMatch(/\/m\/$/)
  })

  it('invite path for org_ deeplink', () => {
    expect(buildMiniAppUrl('org_abc')).toContain('/m/?startapp=org_abc')
  })

  it('event start_param for event_ deeplink', () => {
    expect(buildMiniAppUrl('event_5')).toContain('/m/?startapp=event_5')
  })
})

describe('event invite deeplink (20.1.3)', () => {
  const token = 'Ab_c-1234567890XYZabcdeF'
  it('opens the exact event with the invite token in startapp', () => {
    expect(buildMiniAppUrl(`event_42_${token}`)).toContain(`/m/?startapp=event_42_${token}`)
  })
  it('greets as an event invitation', () => {
    expect(buildStartMessage('Иван', `event_42_${token}`)).toContain('событие')
  })
})
