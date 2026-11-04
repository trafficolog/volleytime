import { describe, expect, it } from 'vitest'

import {
  buildCollectionBody,
  collectionDeadlineIso,
  collectionIconMeta,
  collectionProgress,
  collectionTotals,
  parseCollectionTarget,
  type DesktopCollection,
} from './desktop-collections'

function item(over: Partial<DesktopCollection>): DesktopCollection {
  return {
    id: 1,
    title: 'Сбор',
    description: null,
    icon: 'ball',
    targetAmount: 25000,
    currency: 'BYN',
    status: 'active',
    deadlineAt: null,
    closedAt: null,
    collected: 0,
    pledged: 0,
    contributors: 0,
    ...over,
  }
}

describe('desktop collections helpers', () => {
  it('computes progress and caps it at 100 percent', () => {
    expect(collectionProgress(item({ collected: 17500 }))).toBe(70)
    expect(collectionProgress(item({ collected: 40000 }))).toBe(100)
    expect(collectionProgress(item({ targetAmount: null, collected: 500 }))).toBeNull()
  })

  it('totals ignore cancelled collections and count pledges only for active ones', () => {
    const totals = collectionTotals([
      item({ id: 1, collected: 1000, pledged: 300 }),
      item({ id: 2, status: 'completed', collected: 2000, pledged: 0 }),
      item({ id: 3, status: 'cancelled', collected: 900, pledged: 0 }),
      item({ id: 4, status: 'draft', collected: 0, pledged: 50 }),
    ])
    expect(totals).toEqual({ active: 1, collected: 3000, pledged: 300 })
  })

  it('parses the target in major units to minor units', () => {
    expect(parseCollectionTarget('')).toEqual({ ok: true, value: null })
    expect(parseCollectionTarget('250')).toEqual({ ok: true, value: 25000 })
    expect(parseCollectionTarget('250,5')).toEqual({ ok: true, value: 25050 })
    for (const bad of ['0', '-5', 'abc', '1.234', '99999999999']) {
      expect(parseCollectionTarget(bad)).toEqual({ ok: false })
    }
  })

  it('treats the deadline as the end of the picked day in the group timezone', () => {
    const now = new Date('2026-11-05T10:00:00.000Z')
    expect(collectionDeadlineIso('2026-11-06', 'Europe/Minsk', now)).toBe(
      '2026-11-06T20:59:00.000Z',
    )
    expect(collectionDeadlineIso('2026-11-05', 'Europe/Minsk', now)).toBe(
      '2026-11-05T20:59:00.000Z',
    )
    expect(collectionDeadlineIso('2026-11-04', 'Europe/Minsk', now)).toBeNull()
    expect(collectionDeadlineIso('garbage', 'Europe/Minsk', now)).toBeNull()
  })

  it('builds the create body and reports field errors', () => {
    const now = new Date('2026-11-05T10:00:00.000Z')
    const form = {
      title: '  Новый комплект мячей ',
      description: ' ',
      icon: 'trophy',
      target: '250',
      deadline: '',
      visibility: 'active' as const,
    }
    expect(buildCollectionBody(form, 'Europe/Minsk', now)).toEqual({
      ok: true,
      body: {
        title: 'Новый комплект мячей',
        description: null,
        icon: 'trophy',
        targetAmount: 25000,
        deadlineAt: null,
        status: 'active',
      },
    })
    const bad = buildCollectionBody(
      { ...form, title: ' ', target: '0', deadline: '2026-01-01' },
      'Europe/Minsk',
      now,
    )
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['deadline', 'target', 'title'])
  })

  it('falls back to the ball icon for unknown icons', () => {
    expect(collectionIconMeta('unknown')).toBe(collectionIconMeta('ball'))
  })
})
