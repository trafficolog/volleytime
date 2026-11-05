import { describe, expect, it } from 'vitest'

import {
  buildCollectionBody,
  buildCollectionPatch,
  COLLECTION_CANCEL_LINES,
  collectionDeadlineDay,
  collectionDeadlineIso,
  collectionIconMeta,
  collectionMenuItems,
  collectionProgress,
  collectionTargetInput,
  collectionTotals,
  parseCollectionTarget,
  pendingPledges,
  pledgePlayerName,
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

  it('totals ignore cancelled collections but keep pledges of completed ones', () => {
    const totals = collectionTotals([
      item({ id: 1, collected: 1000, pledged: 300 }),
      item({ id: 2, status: 'completed', collected: 2000, pledged: 700 }),
      item({ id: 3, status: 'cancelled', collected: 900, pledged: 0 }),
      item({ id: 4, status: 'draft', collected: 0, pledged: 50 }),
    ])
    expect(totals).toEqual({ active: 1, collected: 3000, pledged: 1050 })
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

describe('collection row menu by status', () => {
  const keys = (status: DesktopCollection['status']) =>
    collectionMenuItems(status).map((i) => i.key)

  it('offers edit, publish and cancel for a draft', () => {
    expect(keys('draft')).toEqual(['edit', 'publish', 'cancel'])
  })

  it('offers edit, complete and cancel for an active collection', () => {
    expect(keys('active')).toEqual(['edit', 'complete', 'cancel'])
  })

  it('has no actions for closed collections', () => {
    expect(keys('completed')).toEqual([])
    expect(keys('cancelled')).toEqual([])
  })

  it('marks cancel as the separated danger item', () => {
    const cancel = collectionMenuItems('active').at(-1)!
    expect(cancel).toMatchObject({ key: 'cancel', tone: 'danger', separator: true })
  })

  it('warns that pending pledges are rejected and players are notified', () => {
    expect(COLLECTION_CANCEL_LINES[0]).toContain('отклонены')
    expect(COLLECTION_CANCEL_LINES[0]).toContain('получат уведомление')
  })
})

describe('pledges', () => {
  const contribution = (id: number, status: string) => ({
    id,
    user: { id, name: null, telegramUsername: null, image: null },
    amount: 1500,
    currency: 'BYN',
    method: 'cash',
    status,
    createdAt: '2026-11-01T10:00:00.000Z',
    confirmedAt: null,
  })

  it('keeps only pending contributions and tags them with the collection', () => {
    const result = pendingPledges({ id: 7, title: 'Мячи' }, [
      contribution(1, 'pending'),
      contribution(2, 'succeeded'),
      contribution(3, 'pending'),
    ])
    expect(result.map((p) => p.id)).toEqual([1, 3])
    expect(result[0]).toMatchObject({ collectionId: 7, collectionTitle: 'Мячи' })
  })

  it('names the player by name, then username, then a placeholder', () => {
    const base = { id: 1, image: null }
    expect(pledgePlayerName({ ...base, name: ' Аня ', telegramUsername: 'a' })).toBe('Аня')
    expect(pledgePlayerName({ ...base, name: null, telegramUsername: 'anya' })).toBe('@anya')
    expect(pledgePlayerName({ ...base, name: '', telegramUsername: null })).toBe('Игрок')
  })
})

describe('collection edit patch', () => {
  const NOW = new Date('2026-11-05T09:00:00Z')
  const form = {
    title: ' Мячи ',
    description: '',
    icon: 'ball',
    target: '250,50',
    deadline: '',
  }

  it('formats the target for the field', () => {
    expect(collectionTargetInput(null)).toBe('')
    expect(collectionTargetInput(25000)).toBe('250')
    expect(collectionTargetInput(25050)).toBe('250,50')
  })

  it('converts the deadline to a day in the group zone', () => {
    expect(collectionDeadlineDay(null, 'Europe/Minsk')).toBe('')
    expect(collectionDeadlineDay('2026-11-20T20:59:00.000Z', 'Europe/Minsk')).toBe('2026-11-20')
  })

  it('never sends status and omits an untouched deadline', () => {
    const result = buildCollectionPatch(
      { ...form, deadline: '2026-10-01' },
      '2026-10-01',
      'UTC',
      NOW,
    )
    expect(result).toEqual({
      ok: true,
      body: { title: 'Мячи', description: null, icon: 'ball', targetAmount: 25050 },
    })
  })

  it('sends null for a cleared deadline and an ISO value for a changed one', () => {
    const cleared = buildCollectionPatch(form, '2026-12-01', 'UTC', NOW)
    expect(cleared).toMatchObject({ ok: true, body: { deadlineAt: null } })
    const changed = buildCollectionPatch(
      { ...form, deadline: '2026-12-02' },
      '2026-12-01',
      'UTC',
      NOW,
    )
    expect(changed).toMatchObject({ ok: true, body: { deadlineAt: '2026-12-02T23:59:00.000Z' } })
  })

  it('reports field errors', () => {
    const result = buildCollectionPatch({ ...form, title: '', target: '0' }, '', 'UTC', NOW)
    expect(result).toMatchObject({
      ok: false,
      errors: { title: expect.any(String), target: expect.any(String) },
    })
  })

  it('rejects a new deadline in the past', () => {
    const result = buildCollectionPatch({ ...form, deadline: '2026-11-01' }, '', 'UTC', NOW)
    expect(result).toMatchObject({ ok: false, errors: { deadline: expect.any(String) } })
  })
})
