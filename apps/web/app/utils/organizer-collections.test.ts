import { describe, expect, it } from 'vitest'

import {
  buildCollectionPatch,
  collectionActions,
  collectionRemaining,
  deadlineInputValue,
  isManagerMember,
  organizerSections,
  organizerSummary,
  splitContributions,
  targetInputValue,
} from './organizer-collections'

const TZ = 'Europe/Minsk'
const original = {
  title: 'Мячи',
  description: 'Три мяча',
  icon: 'ball',
  targetAmount: 25000,
  deadlineAt: '2026-12-10T20:59:00.000Z',
}
const same = {
  title: 'Мячи',
  description: 'Три мяча',
  icon: 'ball',
  target: '250',
  deadline: '2026-12-10',
}

describe('organizer collections helpers (21.1.5)', () => {
  it('recognises active owners and organizers only', () => {
    expect(isManagerMember({ role: 'owner', status: 'active' })).toBe(true)
    expect(isManagerMember({ role: 'organizer', status: 'active' })).toBe(true)
    expect(isManagerMember({ role: 'player', status: 'active' })).toBe(false)
    expect(isManagerMember({ role: 'owner', status: 'pending' })).toBe(false)
    expect(isManagerMember(null)).toBe(false)
  })

  it('summarises active count and collected total without cancelled collections', () => {
    expect(
      organizerSummary([
        { status: 'active', collected: 17500 },
        { status: 'completed', collected: 60000 },
        { status: 'cancelled', collected: 9900 },
        { status: 'draft', collected: 0 },
      ]),
    ).toEqual({ active: 1, collected: 77500 })
  })

  it('splits the list into drafts, active and finished', () => {
    const s = organizerSections([
      { id: 1, status: 'draft' },
      { id: 2, status: 'active' },
      { id: 3, status: 'completed' },
      { id: 4, status: 'cancelled' },
    ] as const)
    expect(s.draft.map((c) => c.id)).toEqual([1])
    expect(s.active.map((c) => c.id)).toEqual([2])
    expect(s.finished.map((c) => c.id)).toEqual([3, 4])
  })

  it('splits contributions into waiting pledges and paid', () => {
    const s = splitContributions([
      { id: 1, status: 'pending' },
      { id: 2, status: 'succeeded' },
      { id: 3, status: 'pending' },
    ])
    expect(s.pending.map((c) => c.id)).toEqual([1, 3])
    expect(s.paid.map((c) => c.id)).toEqual([2])
  })

  it('computes what is left to the goal and never goes negative', () => {
    expect(collectionRemaining({ collected: 17500, targetAmount: 25000 })).toBe(7500)
    expect(collectionRemaining({ collected: 30000, targetAmount: 25000 })).toBe(0)
    expect(collectionRemaining({ collected: 100, targetAmount: null })).toBeNull()
  })

  describe('collectionActions', () => {
    it('flag on: draft can be published, edited or cancelled', () => {
      expect(collectionActions({ status: 'draft' }, true)).toEqual({
        publish: true,
        edit: true,
        complete: false,
        cancel: true,
        decide: false,
      })
    })

    it('flag on: active can be edited, completed or cancelled and pledges can be decided', () => {
      expect(collectionActions({ status: 'active' }, true)).toEqual({
        publish: false,
        edit: true,
        complete: true,
        cancel: true,
        decide: true,
      })
    })

    it('flag off: publish and edit are hidden, complete, cancel and deciding stay', () => {
      expect(collectionActions({ status: 'active' }, false)).toEqual({
        publish: false,
        edit: false,
        complete: true,
        cancel: true,
        decide: true,
      })
      expect(collectionActions({ status: 'draft' }, false)).toMatchObject({
        publish: false,
        edit: false,
        cancel: true,
      })
    })

    it('completed collections keep waiting pledges decidable but nothing else', () => {
      expect(collectionActions({ status: 'completed' }, true)).toEqual({
        publish: false,
        edit: false,
        complete: false,
        cancel: false,
        decide: true,
      })
    })

    it('cancelled collections have no actions', () => {
      expect(Object.values(collectionActions({ status: 'cancelled' }, true))).not.toContain(true)
    })
  })

  describe('form values', () => {
    it('shows the deadline day in the group time zone', () => {
      expect(deadlineInputValue('2026-12-10T20:59:00.000Z', TZ)).toBe('2026-12-10')
      expect(deadlineInputValue('2026-12-10T21:30:00.000Z', TZ)).toBe('2026-12-11')
      expect(deadlineInputValue(null, TZ)).toBe('')
    })

    it('shows the goal in the main currency unit', () => {
      expect(targetInputValue(25000)).toBe('250')
      expect(targetInputValue(25050)).toBe('250,5')
      expect(targetInputValue(null)).toBe('')
    })
  })

  describe('buildCollectionPatch', () => {
    const now = new Date('2026-11-05T10:00:00.000Z')

    it('sends nothing when nothing changed', () => {
      expect(buildCollectionPatch(original, same, TZ, now)).toEqual({ ok: true, body: {} })
    })

    it('sends only changed fields', () => {
      const result = buildCollectionPatch(
        original,
        { ...same, title: ' Новые мячи ', target: '300,50', icon: 'trophy' },
        TZ,
        now,
      )
      expect(result).toEqual({
        ok: true,
        body: { title: 'Новые мячи', targetAmount: 30050, icon: 'trophy' },
      })
    })

    it('clears the goal and the deadline with null', () => {
      const result = buildCollectionPatch(original, { ...same, target: '', deadline: '' }, TZ, now)
      expect(result).toEqual({ ok: true, body: { targetAmount: null, deadlineAt: null } })
    })

    it('clears the description with null', () => {
      expect(buildCollectionPatch(original, { ...same, description: '  ' }, TZ, now)).toEqual({
        ok: true,
        body: { description: null },
      })
    })

    it('does not resend an unchanged deadline that is already in the past', () => {
      const past = { ...original, deadlineAt: '2026-10-01T20:59:00.000Z' }
      const result = buildCollectionPatch(past, { ...same, deadline: '2026-10-01' }, TZ, now)
      expect(result).toEqual({ ok: true, body: {} })
    })

    it('rejects a new deadline in the past', () => {
      const result = buildCollectionPatch(original, { ...same, deadline: '2026-11-01' }, TZ, now)
      expect(result).toEqual({ ok: false, errors: { deadline: 'Дедлайн должен быть в будущем' } })
    })

    it('rejects an empty title and a bad goal', () => {
      const result = buildCollectionPatch(original, { ...same, title: ' ', target: 'abc' }, TZ, now)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors.title).toBeTruthy()
        expect(result.errors.target).toBeTruthy()
      }
    })

    it('sends a new future deadline as 23:59 of the chosen day in the group zone', () => {
      const result = buildCollectionPatch(original, { ...same, deadline: '2026-12-20' }, TZ, now)
      expect(result).toEqual({ ok: true, body: { deadlineAt: '2026-12-20T20:59:00.000Z' } })
    })
  })
})
