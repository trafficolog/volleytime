import { describe, expect, it } from 'vitest'

import {
  collectionCtaLabel,
  collectionDeadlineLabel,
  collectionMyStatus,
  collectionProgress,
  collectionSections,
  parsePledgeAmount,
  pledgeToastText,
  type PlayerCollection,
} from './collections'

const base: PlayerCollection = {
  id: 1,
  title: 'Мячи',
  description: null,
  icon: 'ball',
  targetAmount: 25000,
  currency: 'BYN',
  status: 'active',
  deadlineAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  closedAt: null,
  createdBy: { id: 5, name: 'Организатор' },
  collected: 17500,
  pledged: 0,
  contributors: 3,
  my: { paid: 0, pending: null },
}

describe('collectionProgress', () => {
  it('rounds the share and caps it at 100', () => {
    expect(collectionProgress(17500, 25000)).toBe(70)
    expect(collectionProgress(30000, 25000)).toBe(100)
  })
  it('has no progress without a target', () => {
    expect(collectionProgress(500, null)).toBeNull()
  })
})

describe('collectionSections', () => {
  it('puts active collections first and everything closed into finished', () => {
    const list = [
      { ...base, id: 1, status: 'active' as const },
      { ...base, id: 2, status: 'completed' as const },
      { ...base, id: 3, status: 'cancelled' as const },
    ]
    const sections = collectionSections(list)
    expect(sections.active.map((c) => c.id)).toEqual([1])
    expect(sections.finished.map((c) => c.id)).toEqual([2, 3])
  })
})

describe('collectionMyStatus', () => {
  it('shows a pledge as amber and a confirmed contribution as grass', () => {
    expect(
      collectionMyStatus({ paid: 0, pending: { id: 9, amount: 1500, method: 'cash' } }, 'BYN'),
    ).toEqual({ tone: 'amber', label: 'обещано 15,00 BYN' })
    expect(collectionMyStatus({ paid: 3500, pending: null }, 'BYN')).toEqual({
      tone: 'grass',
      label: 'внесли 35,00 BYN',
    })
  })
  it('prefers the pending pledge when both exist and returns null for nothing', () => {
    expect(
      collectionMyStatus({ paid: 1000, pending: { id: 9, amount: 500, method: 'transfer' } }, 'BYN')
        ?.tone,
    ).toBe('amber')
    expect(collectionMyStatus({ paid: 0, pending: null }, 'BYN')).toBeNull()
  })
})

describe('collectionDeadlineLabel (display only)', () => {
  const now = new Date('2026-10-20T12:00:00Z')
  it('is absent without a deadline', () => {
    expect(collectionDeadlineLabel(null, 'Europe/Minsk', now)).toBeNull()
  })
  it('names the date and the days left for a future deadline', () => {
    expect(collectionDeadlineLabel('2026-10-28T12:00:00Z', 'Europe/Minsk', now)).toEqual({
      date: 'до 28 октября',
      left: 'осталось 8 дн.',
    })
  })
  it('only says the date passed, without closing anything', () => {
    expect(collectionDeadlineLabel('2026-10-10T12:00:00Z', 'Europe/Minsk', now)).toEqual({
      date: 'до 10 октября',
      left: 'срок прошёл',
    })
  })
})

describe('collectionCtaLabel', () => {
  it('says replace when a pledge is waiting', () => {
    expect(collectionCtaLabel({ paid: 0, pending: { id: 1, amount: 100, method: 'cash' } })).toBe(
      'Заменить обещанный взнос',
    )
  })
  it('says contribute again after a confirmed contribution', () => {
    expect(collectionCtaLabel({ paid: 100, pending: null })).toBe('Внести ещё')
    expect(collectionCtaLabel({ paid: 0, pending: null })).toBe('Внести взнос')
  })
})

describe('parsePledgeAmount', () => {
  it('converts BYN with a comma or a dot to minor units', () => {
    expect(parsePledgeAmount('15')).toBe(1500)
    expect(parsePledgeAmount('12,5')).toBe(1250)
    expect(parsePledgeAmount(' 7.05 ')).toBe(705)
  })
  it('rejects empty, zero, negative, over-precise and over-limit values', () => {
    for (const bad of ['', '0', '0,00', '-5', '1,234', 'abc', '100000,01', '1e3'])
      expect(parsePledgeAmount(bad)).toBeNull()
    expect(parsePledgeAmount('100000')).toBe(10_000_000)
  })
})

describe('pledgeToastText', () => {
  it('tells that a repeat pledge replaced the previous one', () => {
    expect(pledgeToastText(1500, 'BYN', true)).toBe(
      'Обещание заменено на 15,00 BYN · ждём подтверждения',
    )
    expect(pledgeToastText(1500, 'BYN', false)).toBe('Обещано 15,00 BYN · ждём подтверждения')
  })
})
