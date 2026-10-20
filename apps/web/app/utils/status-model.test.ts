import { describe, expect, it } from 'vitest'

import {
  eventStateOf,
  meterTint,
  meterTintOnDark,
  meterTone,
  overlapsOf,
  participationOf,
  pendingLabel,
  waitlistOrganizerLabel,
  waitlistPeopleLabel,
  pendingVerb,
  pendingOf,
  seatsOf,
} from './status-model'

const NOW = new Date('2026-10-13T12:00:00.000Z')
const future = { startsAt: '2026-10-20T16:00:00.000Z', endsAt: '2026-10-20T18:00:00.000Z' }
const started = { startsAt: '2026-10-13T11:00:00.000Z', endsAt: '2026-10-13T13:00:00.000Z' }
const ended = { startsAt: '2026-10-12T16:00:00.000Z', endsAt: '2026-10-12T18:00:00.000Z' }

describe('participationOf', () => {
  it.each(['confirmed', 'pending_payment'])('%s means «Иду» with a check', (status) => {
    expect(participationOf({ status })).toEqual({ key: 'going', label: 'Иду', icon: 'check' })
  })

  it('shows queue position when known and a plain label otherwise', () => {
    expect(participationOf({ status: 'waitlisted', waitPos: 3 })).toEqual({
      key: 'waitlist',
      label: 'В очереди · 3-й',
      icon: 'clock',
    })
    expect(participationOf({ status: 'waitlisted' })?.label).toBe('В очереди')
    expect(participationOf({ status: 'waitlisted', waitPos: 0 })?.label).toBe('В очереди')
  })

  it('main seats plus queued seats: «Иду · +N в очереди · M-й» (20.4.11, c)', () => {
    expect(participationOf({ status: 'confirmed', waitlistSeats: 1, waitPos: 2 })).toEqual({
      key: 'going',
      label: 'Иду · +1 в очереди · 2-й',
      icon: 'check',
    })
    expect(
      participationOf({ status: 'pending_payment', waitlistSeats: 2, waitPos: 1 })?.label,
    ).toBe('Иду · +2 в очереди · 1-й')
    // очередь уже не движется (позиции нет) или мест в очереди нет — просто «Иду»
    expect(participationOf({ status: 'confirmed', waitlistSeats: 1, waitPos: null })?.label).toBe(
      'Иду',
    )
    expect(participationOf({ status: 'confirmed', waitlistSeats: 0, waitPos: 3 })?.label).toBe(
      'Иду',
    )
    expect(participationOf({ status: 'confirmed' })?.label).toBe('Иду')
  })

  it('an explicit null position on the waitlist means the player did not get in («Не попали», d)', () => {
    expect(participationOf({ status: 'waitlisted', waitPos: null })).toEqual({
      key: 'missed',
      label: 'Не попали',
      icon: 'clock',
    })
  })

  it.each(['cancelled', 'no_show', 'attended'])('%s and no booking give no chip', (status) => {
    expect(participationOf({ status })).toBeNull()
    expect(participationOf(null)).toBeNull()
    expect(participationOf(undefined)).toBeNull()
  })
})

describe('waitlistPeopleLabel', () => {
  it('counts people, not seats', () => {
    expect(waitlistPeopleLabel(3)).toBe('в очереди 3 чел.')
  })
})

describe('waitlistOrganizerLabel', () => {
  it('shows people and seats when they differ, people only otherwise', () => {
    expect(waitlistOrganizerLabel(2, 3)).toBe('2 чел. · 3 места')
    expect(waitlistOrganizerLabel(2, 2)).toBe('2 чел.')
    expect(waitlistOrganizerLabel(2, undefined)).toBe('2 чел.')
  })
})

describe('eventStateOf', () => {
  it('is null for an open published event', () => {
    expect(eventStateOf({ status: 'published', ...future }, NOW)).toBeNull()
  })

  it('names cancelled, past and closed', () => {
    expect(eventStateOf({ status: 'cancelled', ...future }, NOW)).toEqual({
      key: 'cancelled',
      label: 'Отменена',
    })
    expect(eventStateOf({ status: 'finished', ...future }, NOW)?.label).toBe('Прошла')
    expect(eventStateOf({ status: 'published', ...ended }, NOW)?.label).toBe('Прошла')
    expect(eventStateOf({ status: 'closed', ...future }, NOW)?.label).toBe('Запись закрыта')
    expect(eventStateOf({ status: 'published', ...started }, NOW)?.label).toBe('Запись закрыта')
  })

  it('cancelled wins over past, past wins over closed', () => {
    expect(eventStateOf({ status: 'cancelled', ...ended }, NOW)?.key).toBe('cancelled')
    expect(eventStateOf({ status: 'closed', ...ended }, NOW)?.key).toBe('past')
  })

  it('marks an upcoming draft', () => {
    expect(eventStateOf({ status: 'draft', ...future }, NOW)).toEqual({
      key: 'draft',
      label: 'Черновик',
    })
  })

  it('a draft with a past start is still a draft', () => {
    expect(eventStateOf({ status: 'draft', ...ended }, NOW)?.key).toBe('draft')
    expect(eventStateOf({ status: 'draft', ...started }, NOW)?.label).toBe('Черновик')
  })

  it('works without endsAt', () => {
    expect(eventStateOf({ status: 'published', startsAt: future.startsAt }, NOW)).toBeNull()
  })
})

describe('closed + going stays two independent axes', () => {
  it('a closed event does not hide the player participation', () => {
    expect(eventStateOf({ status: 'closed', ...future }, NOW)?.label).toBe('Запись закрыта')
    expect(participationOf({ status: 'confirmed' })?.key).toBe('going')
  })
})

describe('meter tint', () => {
  it.each([
    [0, 'grass'],
    [70, 'grass'],
    [71, 'amber'],
    [99, 'amber'],
    [100, 'rose'],
    [130, 'rose'],
  ] as const)('%i%% is %s', (pct, tone) => {
    expect(meterTone(pct)).toBe(tone)
    expect(meterTint(pct)).toBe(`var(--vt-${tone})`)
  })

  it('has light tones on dark surfaces', () => {
    expect(meterTintOnDark(50)).toBe('var(--vt-meter-ok-on-hero)')
    expect(meterTintOnDark(80)).toBe('var(--vt-amber-on-hero)')
    expect(meterTintOnDark(100)).toBe('var(--vt-rose-on-hero)')
  })
})

describe('seatsOf', () => {
  it('shows numbers for an open event', () => {
    expect(seatsOf({ taken: 5, capacity: 16 })).toMatchObject({
      text: '5/16',
      full: false,
      dim: false,
      tone: 'grass',
    })
  })

  it('says «мест нет» when full and open', () => {
    expect(seatsOf({ taken: 16, capacity: 16 })).toMatchObject({
      text: 'мест нет',
      full: true,
      tone: 'rose',
      pct: 100,
    })
  })

  it('keeps the numbers and dims the meter when the event has a state', () => {
    const closed = { key: 'closed', label: 'Запись закрыта' } as const
    expect(seatsOf({ taken: 16, capacity: 16 }, closed)).toMatchObject({
      text: '16/16',
      dim: true,
    })
  })

  it('counts seats, so one booking may take several', () => {
    expect(seatsOf({ taken: 14, capacity: 16 })).toMatchObject({ pct: 87.5, tone: 'amber' })
  })

  it('survives zero capacity', () => {
    expect(seatsOf({ taken: 0, capacity: 0 })).toMatchObject({ pct: 0, full: false })
  })
})

describe('pending', () => {
  it.each([
    [0, '0 ждут'],
    [1, '1 ждёт'],
    [2, '2 ждут'],
    [5, '5 ждут'],
    [11, '11 ждут'],
    [21, '21 ждёт'],
    [22, '22 ждут'],
  ])('%i → %s', (n, text) => {
    expect(pendingLabel(n)).toBe(text)
  })

  it('agrees the bare verb for stat captions', () => {
    expect(pendingVerb(1)).toBe('ждёт')
    expect(pendingVerb(3)).toBe('ждут')
  })

  it('counts bookings awaiting payment', () => {
    expect(
      pendingOf([
        { status: 'pending_payment' },
        { status: 'confirmed' },
        { status: 'pending_payment' },
      ]),
    ).toBe(2)
  })
})

describe('overlapsOf', () => {
  const a = { id: 1, startsAt: '2026-10-20T16:00:00Z', endsAt: '2026-10-20T18:00:00Z' }
  const b = { id: 2, startsAt: '2026-10-20T17:30:00Z', endsAt: '2026-10-20T19:00:00Z' }
  const c = { id: 3, startsAt: '2026-10-20T18:00:00Z', endsAt: '2026-10-20T19:00:00Z' }
  it('finds real overlaps and ignores touching intervals and itself', () => {
    expect(overlapsOf(a, [a, b, c]).map((e) => e.id)).toEqual([2])
  })
})
