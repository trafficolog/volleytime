import { describe, expect, it } from 'vitest'

import {
  LEVEL_FILTER_ALL,
  LEVEL_FILTER_NONE,
  filterByLevel,
  levelFilterOptions,
  levelTitle,
  type PlayerLevelView,
} from './player-level'

const levels: PlayerLevelView[] = [
  { code: 'v1', title: 'В1', description: 'Полупрофи', sortOrder: 1 },
  { code: 'v2', title: 'В2', description: 'Сильный любитель', sortOrder: 2 },
  { code: 'v3', title: 'В3', description: 'Средний любитель', sortOrder: 3 },
  { code: 'v4', title: 'В4', description: 'Продолжающие', sortOrder: 4 },
  { code: 'v4_plus', title: 'В4+', description: 'Начинающие', sortOrder: 5 },
]

describe('levelTitle', () => {
  it('maps a level code to its scale title from the reference', () => {
    expect(levelTitle('v2', levels)).toBe('В2')
    expect(levelTitle('v4_plus', levels)).toBe('В4+')
  })

  it('returns null for a missing level or an unknown code', () => {
    expect(levelTitle(null, levels)).toBeNull()
    expect(levelTitle(undefined, levels)).toBeNull()
    expect(levelTitle('v9', levels)).toBeNull()
  })
})

describe('filterByLevel', () => {
  const rows = [
    { id: 1, level: 'v1' },
    { id: 2, level: null },
    { id: 3, level: 'v4_plus' },
    { id: 4, level: 'v1' },
  ]

  it('keeps every row for the all filter', () => {
    expect(filterByLevel(rows, LEVEL_FILTER_ALL).map((r) => r.id)).toEqual([1, 2, 3, 4])
  })

  it('keeps rows of one level', () => {
    expect(filterByLevel(rows, 'v1').map((r) => r.id)).toEqual([1, 4])
  })

  it('keeps rows without a level for the none filter', () => {
    expect(filterByLevel(rows, LEVEL_FILTER_NONE).map((r) => r.id)).toEqual([2])
  })

  it('does not mutate the input array', () => {
    const copy = [...rows]
    filterByLevel(rows, 'v1')
    expect(rows).toEqual(copy)
  })
})

describe('levelFilterOptions', () => {
  it('lists all, the levels in scale order and the no-level choice', () => {
    const options = levelFilterOptions(levels)
    expect(options.map((o) => o.value)).toEqual([
      LEVEL_FILTER_ALL,
      'v1',
      'v2',
      'v3',
      'v4',
      'v4_plus',
      LEVEL_FILTER_NONE,
    ])
    expect(options[0]?.label).toBe('Все')
    expect(options.at(-1)?.label).toBe('Без уровня')
  })

  it('never contains A/B/C labels', () => {
    const labels = levelFilterOptions(levels).map((o) => o.label)
    expect(labels.some((l) => /^[ABC]$/.test(l))).toBe(false)
  })
})
