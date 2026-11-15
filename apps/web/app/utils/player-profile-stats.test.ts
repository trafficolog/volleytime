import { describe, expect, it } from 'vitest'

import { profileStatTiles, STATS_WINDOW_NOTE } from './player-profile-stats'

describe('profileStatTiles (21.4.8, M-13)', () => {
  it('shows visits, attendance rate and no-shows as in the mockup', () => {
    expect(
      profileStatTiles({ visits: 24, noShows: 3, ratePercent: 89 }).map((t) => [t.value, t.label]),
    ).toEqual([
      ['24', 'тренировок'],
      ['89%', 'посещ.'],
      ['3', 'no-show'],
    ])
  })

  it('shows a dash instead of a rate when there is nothing to count', () => {
    expect(profileStatTiles({ visits: 0, noShows: 0, ratePercent: null })[1]!.value).toBe('—')
  })

  it('names the counting window honestly', () => {
    expect(STATS_WINDOW_NOTE).toBe('за последние 90 дней')
  })
})
