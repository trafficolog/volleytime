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
})
