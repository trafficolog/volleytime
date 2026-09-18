import { describe, expect, it } from 'vitest'

import {
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

  it('parses invite input variants (4.9.18)', () => {
    expect(parseInviteInput('https://t.me/volleytime_bot?start=org_Tok_12345')).toBe('Tok_12345')
    expect(parseInviteInput('org_Tok_12345')).toBe('Tok_12345')
    expect(parseInviteInput('https://volleytime.by/m/invite/Tok_12345')).toBe('Tok_12345')
    expect(parseInviteInput('Tok_12345')).toBe('Tok_12345')
    expect(parseInviteInput('привет')).toBeNull()
  })
})
