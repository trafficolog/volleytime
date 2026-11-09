// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import {
  acceptFailureState,
  clearTransferToken,
  deleteNameMatches,
  formatDangerDate,
  readTransferToken,
  stashTransferToken,
  transferOptions,
} from './group-danger'

const err = (code: string) => ({ data: { data: { code } } })

describe('group danger zone helpers (21.2.17)', () => {
  it('matches the group name exactly, ignoring only surrounding spaces', () => {
    expect(deleteNameMatches('VolleyTime Минск', 'VolleyTime Минск')).toBe(true)
    expect(deleteNameMatches('  VolleyTime Минск ', 'VolleyTime Минск')).toBe(true)
    expect(deleteNameMatches('volleytime минск', 'VolleyTime Минск')).toBe(false)
    expect(deleteNameMatches('VolleyTime', 'VolleyTime Минск')).toBe(false)
    expect(deleteNameMatches('', '')).toBe(false)
    expect(deleteNameMatches('   ', '   ')).toBe(false)
  })

  it('offers only active non-owner members as transfer recipients', () => {
    const user = (id: number, name: string | null, telegramUsername: string | null = null) => ({
      id,
      name,
      telegramUsername,
    })
    const options = transferOptions(
      [
        { id: 1, role: 'owner', status: 'active', user: user(10, 'Владелец') },
        { id: 2, role: 'player', status: 'active', user: user(11, 'Яна') },
        { id: 3, role: 'organizer', status: 'active', user: user(12, 'Борис') },
        { id: 4, role: 'player', status: 'pending', user: user(13, 'Заявка') },
        { id: 5, role: 'assistant', status: 'active', user: user(14, null, 'nick') },
      ],
      10,
    )
    expect(options).toEqual([
      { value: '5', label: '@nick', sub: 'Помощник' },
      { value: '3', label: 'Борис', sub: 'Организатор' },
      { value: '2', label: 'Яна', sub: 'Игрок' },
    ])
  })

  it('formats dates in the group time zone', () => {
    expect(formatDangerDate('2026-12-09T21:30:00.000Z', 'Europe/Minsk')).toMatch(
      /10 декабря 2026.*00:30/,
    )
  })

  it('maps refused accepts to page states', () => {
    expect(acceptFailureState(err('ownership_transfer.used'))).toBe('accepted')
    expect(acceptFailureState(err('ownership_transfer.cancelled'))).toBe('cancelled')
    expect(acceptFailureState(err('ownership_transfer.expired'))).toBe('expired')
    expect(acceptFailureState(err('ownership_transfer.invalid'))).toBe('invalid')
    expect(acceptFailureState(err('internal_error'))).toBe('error')
  })

  it('keeps only a well-formed token for the session', () => {
    clearTransferToken()
    stashTransferToken('bad token')
    expect(readTransferToken()).toBeNull()
    const token = 'x'.repeat(43)
    stashTransferToken(token)
    expect(readTransferToken()).toBe(token)
    clearTransferToken()
    expect(readTransferToken()).toBeNull()
  })
})
