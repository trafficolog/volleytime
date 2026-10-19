import { describe, expect, it } from 'vitest'

import {
  buildBotStartAppDeeplink,
  buildEventInviteStartParam,
  buildInviteDeeplink,
  buildShareUrl,
  buildStartParam,
  DeeplinkConfigError,
  parseInviteInput,
  resolveStartParam,
} from './deeplink'

describe('telegram deeplinks (4.9.2)', () => {
  it('builds invite link with bot username', () => {
    expect(buildInviteDeeplink('@volleytime_bot', 'AbC123xyz')).toBe(
      'https://t.me/volleytime_bot?start=org_AbC123xyz',
    )
  })
  it('SECURITY/UX: empty bot username throws instead of https://t.me/?start=…', () => {
    expect(() => buildInviteDeeplink('', 'tok12345')).toThrow(DeeplinkConfigError)
  })
  it('builds a startapp link for group chats (20.3.4)', () => {
    expect(buildBotStartAppDeeplink('@volleytime_bot', 'event_42')).toBe(
      'https://t.me/volleytime_bot?startapp=event_42',
    )
    expect(() => buildBotStartAppDeeplink('', 'event_42')).toThrow(DeeplinkConfigError)
    expect(() => buildBotStartAppDeeplink('volleytime_bot', 'bad param')).toThrow()
  })
  it('validates start_param charset', () => {
    expect(buildStartParam('event', 42)).toBe('event_42')
    expect(() => buildStartParam('org', 'bad token')).toThrow()
  })
  it('share url encodes link', () => {
    expect(buildShareUrl('https://t.me/b?start=org_x', 'Привет')).toContain(
      'url=https%3A%2F%2Ft.me',
    )
  })
  it('resolves Mini App start_param (8.8.3)', () => {
    expect(resolveStartParam('org_Tok_123')).toEqual({ kind: 'invite', token: 'Tok_123' })
    expect(resolveStartParam('event_42')).toEqual({ kind: 'event', eventId: 42 })
    expect(resolveStartParam('event_abc')).toEqual({ kind: 'none' })
    expect(resolveStartParam(null)).toEqual({ kind: 'none' })
  })

  it('event invite start_param carries event id and token (20.1.3)', () => {
    const token = 'Ab_c-1234567890XYZabcdeF'
    const param = buildEventInviteStartParam(42, token)
    expect(param).toBe(`event_42_${token}`)
    expect(param.length).toBeLessThanOrEqual(64)
    expect(resolveStartParam(param)).toEqual({ kind: 'event', eventId: 42, inviteToken: token })
    // токен из одних цифр не путается с id события
    expect(resolveStartParam('event_7_1234567890123456')).toEqual({
      kind: 'event',
      eventId: 7,
      inviteToken: '1234567890123456',
    })
    expect(resolveStartParam('event_42_short')).toEqual({ kind: 'none' })
    expect(() => buildEventInviteStartParam(0, token)).toThrow()
    expect(() => buildEventInviteStartParam(1, 'bad token!')).toThrow()
  })

  it('parses invite input variants (4.9.18)', () => {
    expect(parseInviteInput('https://t.me/volleytime_bot?start=org_Tok_12345')).toBe('Tok_12345')
    expect(parseInviteInput('org_Tok_12345')).toBe('Tok_12345')
    expect(parseInviteInput('https://volleytime.by/m/invite/Tok_12345')).toBe('Tok_12345')
    expect(parseInviteInput('Tok_12345')).toBe('Tok_12345')
    expect(parseInviteInput('привет')).toBeNull()
  })
})
