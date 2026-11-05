import { describe, expect, it } from 'vitest'

import { PLAYER_POSITIONS, levelAndPosition, positionTitle } from './player-position'

describe('player position labels (21.2.22)', () => {
  it('lists the six confirmed values with Russian labels', () => {
    expect(PLAYER_POSITIONS.map((p) => p.code)).toEqual([
      'setter',
      'outside_hitter',
      'opposite',
      'middle_blocker',
      'libero',
      'utility',
    ])
    expect(PLAYER_POSITIONS.map((p) => p.title)).toEqual([
      'Связующий',
      'Доигровщик',
      'Диагональный',
      'Центральный блокирующий',
      'Либеро',
      'Универсал',
    ])
  })

  it('resolves a title and tolerates empty or unknown codes', () => {
    expect(positionTitle('libero')).toBe('Либеро')
    expect(positionTitle(null)).toBeNull()
    expect(positionTitle(undefined)).toBeNull()
    expect(positionTitle('goalkeeper')).toBeNull()
  })

  it('joins level and position for the profile line', () => {
    expect(levelAndPosition('В2', 'outside_hitter')).toBe('В2 · доигровщик')
    expect(levelAndPosition('В2', null)).toBe('В2')
    expect(levelAndPosition(null, 'setter')).toBe('связующий')
    expect(levelAndPosition(null, null)).toBe('')
  })
})
