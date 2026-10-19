import { describe, expect, it } from 'vitest'

import { parseDeeplink } from './deeplink'

describe('parseDeeplink', () => {
  it('none for undefined/empty', () => {
    expect(parseDeeplink(undefined)).toEqual({ kind: 'none' })
    expect(parseDeeplink('')).toEqual({ kind: 'none' })
  })

  it('parses org_ invite token', () => {
    expect(parseDeeplink('org_abc123')).toEqual({ kind: 'org_invite', token: 'abc123' })
  })

  it('parses event_ id', () => {
    expect(parseDeeplink('event_42')).toEqual({ kind: 'event', eventId: 42 })
  })

  it('none for org_ without token', () => {
    expect(parseDeeplink('org_')).toEqual({ kind: 'none' })
  })

  it('none for event_ with invalid id', () => {
    expect(parseDeeplink('event_abc')).toEqual({ kind: 'none' })
    expect(parseDeeplink('event_0')).toEqual({ kind: 'none' })
  })

  it('none for unknown prefix', () => {
    expect(parseDeeplink('random123')).toEqual({ kind: 'none' })
  })

  it('parses personal event invite event_<id>_<token> (20.1.3)', () => {
    const token = 'Ab_c-1234567890XYZabcdeF'
    expect(parseDeeplink(`event_42_${token}`)).toEqual({
      kind: 'event',
      eventId: 42,
      inviteToken: token,
    })
  })

  it('none for malformed event invite token', () => {
    expect(parseDeeplink('event_42_short')).toEqual({ kind: 'none' })
    expect(parseDeeplink('event_42_bad token!!!!!!!!!')).toEqual({ kind: 'none' })
    expect(parseDeeplink('event_0_Ab_c-1234567890XYZabcdeF')).toEqual({ kind: 'none' })
  })
})
