import { describe, expect, it } from 'vitest'

import {
  buildChangedCollectionPatch,
  canDecidePledges,
  collectionRemaining,
  isManagerMember,
  organizerSections,
  paidContributions,
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

  it('keeps confirmed contributions only', () => {
    expect(
      paidContributions([
        { id: 1, status: 'pending' },
        { id: 2, status: 'succeeded' },
      ]).map((c) => c.id),
    ).toEqual([2])
  })

  it('computes what is left to the goal and never goes negative', () => {
    expect(collectionRemaining({ collected: 17500, targetAmount: 25000 })).toBe(7500)
    expect(collectionRemaining({ collected: 30000, targetAmount: 25000 })).toBe(0)
    expect(collectionRemaining({ collected: 100, targetAmount: null })).toBeNull()
  })

  it('lets pledges be decided on active and finished collections only', () => {
    expect(canDecidePledges('active')).toBe(true)
    expect(canDecidePledges('completed')).toBe(true)
    expect(canDecidePledges('draft')).toBe(false)
    expect(canDecidePledges('cancelled')).toBe(false)
  })

  describe('buildChangedCollectionPatch', () => {
    const now = new Date('2026-11-05T10:00:00.000Z')

    it('sends nothing when nothing changed', () => {
      expect(buildChangedCollectionPatch(original, same, TZ, now)).toEqual({ ok: true, body: {} })
    })

    it('sends only changed fields', () => {
      const result = buildChangedCollectionPatch(
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
      const result = buildChangedCollectionPatch(
        original,
        { ...same, target: '', deadline: '' },
        TZ,
        now,
      )
      expect(result).toEqual({ ok: true, body: { targetAmount: null, deadlineAt: null } })
    })

    it('clears the description with null', () => {
      expect(
        buildChangedCollectionPatch(original, { ...same, description: '  ' }, TZ, now),
      ).toEqual({ ok: true, body: { description: null } })
    })

    it('does not resend an unchanged deadline that is already in the past', () => {
      const past = { ...original, deadlineAt: '2026-10-01T20:59:00.000Z' }
      const result = buildChangedCollectionPatch(past, { ...same, deadline: '2026-10-01' }, TZ, now)
      expect(result).toEqual({ ok: true, body: {} })
    })

    it('rejects a new deadline in the past', () => {
      const result = buildChangedCollectionPatch(
        original,
        { ...same, deadline: '2026-11-01' },
        TZ,
        now,
      )
      expect(result).toEqual({ ok: false, errors: { deadline: 'Дедлайн должен быть в будущем' } })
    })

    it('rejects an empty title and a bad goal', () => {
      const result = buildChangedCollectionPatch(
        original,
        { ...same, title: ' ', target: 'abc' },
        TZ,
        now,
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors.title).toBeTruthy()
        expect(result.errors.target).toBeTruthy()
      }
    })

    it('sends a new future deadline as 23:59 of the chosen day in the group zone', () => {
      const result = buildChangedCollectionPatch(
        original,
        { ...same, deadline: '2026-12-20' },
        TZ,
        now,
      )
      expect(result).toEqual({ ok: true, body: { deadlineAt: '2026-12-20T20:59:00.000Z' } })
    })
  })
})
