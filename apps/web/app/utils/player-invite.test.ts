import { describe, expect, it } from 'vitest'

import {
  clearStashedInviteToken,
  compactRoster,
  inviteBookingToken,
  inviteChip,
  inviteExpiryLabel,
  inviteGate,
  inviteSentLabel,
  organizerLine,
  readStashedInviteToken,
  stashInviteToken,
  type InviteAccessView,
} from './player-invite'

const person = { name: 'Иван Петренко', telegramUsername: null, image: null }
const access = (over: Partial<InviteAccessView> = {}): InviteAccessView => ({
  state: 'none',
  request: null,
  invite: null,
  organizer: person,
  ...over,
})
const base = { joinMode: 'invite', isManager: false, hasBooking: false, loaded: true }

describe('inviteGate (D-06: four states, fail closed)', () => {
  it('open events and bookings are not gated', () => {
    expect(inviteGate({ ...base, joinMode: 'open', access: null })).toEqual({
      show: false,
      state: null,
      canBook: true,
    })
    expect(inviteGate({ ...base, hasBooking: true, access: access() }).show).toBe(false)
  })

  it('owner and organizer book themselves without an invite (D-06 C)', () => {
    expect(inviteGate({ ...base, isManager: true, access: null })).toEqual({
      show: false,
      state: null,
      canBook: true,
    })
  })

  it('only the invited state may book; unknown state cannot', () => {
    expect(inviteGate({ ...base, access: null, loaded: false })).toMatchObject({
      show: false,
      canBook: false,
    })
    for (const state of ['none', 'requested', 'expired'] as const) {
      expect(inviteGate({ ...base, access: access({ state }) })).toEqual({
        show: true,
        state,
        canBook: false,
      })
    }
    expect(inviteGate({ ...base, access: access({ state: 'invited' }) })).toEqual({
      show: true,
      state: 'invited',
      canBook: true,
    })
  })
})

describe('invite chips', () => {
  it('names each state as in the approved screens', () => {
    expect(inviteChip('none')).toMatchObject({ text: 'по приглашению', tone: 'default' })
    expect(inviteChip('requested')).toMatchObject({ text: 'запрос отправлен', tone: 'amber' })
    expect(inviteChip('invited')).toMatchObject({ text: 'вы приглашены', tone: 'grass' })
    expect(inviteChip('expired')).toMatchObject({ text: 'ссылка просрочена', tone: 'rose' })
  })
})

describe('booking token', () => {
  it('is sent only when the invite comes from the personal link', () => {
    const link = access({
      state: 'invited',
      invite: { source: 'link', expiresAt: null, inviter: null },
    })
    const request = access({
      state: 'invited',
      invite: { source: 'request', expiresAt: null, inviter: null },
    })
    expect(inviteBookingToken(link, 'tok')).toBe('tok')
    expect(inviteBookingToken(request, 'tok')).toBeUndefined()
    expect(inviteBookingToken(link, null)).toBeUndefined()
    expect(inviteBookingToken(null, 'tok')).toBeUndefined()
  })

  it('is stashed per event in session storage and cleared after use', () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
    stashInviteToken(7, 'abc', storage)
    expect(readStashedInviteToken(7, storage)).toBe('abc')
    expect(readStashedInviteToken(8, storage)).toBeNull()
    clearStashedInviteToken(7, storage)
    expect(readStashedInviteToken(7, storage)).toBeNull()
  })

  it('survives a blocked storage', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(() => stashInviteToken(1, 'abc', broken)).not.toThrow()
    expect(readStashedInviteToken(1, broken)).toBeNull()
    expect(() => clearStashedInviteToken(1, broken)).not.toThrow()
  })
})

describe('compact roster (owner decision 2026-10-20)', () => {
  it('is used while the invite gate is shown, not for open events or after booking', () => {
    expect(inviteGate({ ...base, access: access() }).show).toBe(true)
    expect(inviteGate({ ...base, joinMode: 'open', access: null }).show).toBe(false)
    expect(inviteGate({ ...base, hasBooking: true, access: access() }).show).toBe(false)
  })

  it('shows up to five avatars and «и ещё N · M мест свободно»', () => {
    expect(compactRoster(11, 3)).toEqual({ shown: 5, rest: 6, text: 'и ещё 6 · 3 места свободно' })
    expect(compactRoster(3, 5)).toEqual({ shown: 3, rest: 0, text: '5 мест свободно' })
    expect(compactRoster(7, 1).text).toBe('и ещё 2 · 1 место свободно')
    expect(compactRoster(5, 0).text).toBe('мест нет')
    expect(compactRoster(0, 4)).toEqual({ shown: 0, rest: 0, text: '4 места свободно' })
    expect(compactRoster(9, 0).text).toBe('и ещё 4 · мест нет')
  })
})

describe('labels', () => {
  const tz = 'Europe/Minsk'
  it('expiry: «29 мая, 20:00»', () => {
    expect(inviteExpiryLabel('2026-05-29T17:00:00.000Z', tz)).toBe('29 мая, 20:00')
  })
  it('sent time: today, yesterday, then the date', () => {
    const now = new Date('2026-05-29T16:30:00.000Z')
    expect(inviteSentLabel('2026-05-29T16:24:00.000Z', now, tz)).toBe('сегодня, 19:24')
    expect(inviteSentLabel('2026-05-28T16:24:00.000Z', now, tz)).toBe('вчера, 19:24')
    expect(inviteSentLabel('2026-05-20T16:24:00.000Z', now, tz)).toBe('20 мая, 19:24')
  })
  it('organizer line', () => {
    expect(organizerLine(person)).toBe('Иван Петренко · организатор')
    expect(organizerLine(null)).toBe('Организатор')
  })
})
