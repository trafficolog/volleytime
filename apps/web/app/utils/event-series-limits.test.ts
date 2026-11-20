import { describe, expect, it } from 'vitest'

import { seriesBalanceNote, type SeriesPreviewView } from './event-series'

const preview = (over: Partial<SeriesPreviewView> = {}): SeriesPreviewView => ({
  timezone: 'Europe/Minsk',
  dates: [],
  excluded: [],
  total: 4,
  published: 4,
  drafts: 0,
  venueConflicts: 0,
  balanceEnforced: true,
  balanceBefore: 10,
  balanceAfter: 6,
  ...over,
})

/** Task 22.3.1: безлимит и дневной лимит платформы в предпросмотре серии. */
describe('series balance note with unlimited and the daily limit', () => {
  it('says nothing is charged while unlimited', () => {
    const note = seriesBalanceNote(preview({ unlimited: true, balanceAfter: 10 }))
    expect(note.tone).toBe('neutral')
    expect(note.text).toContain('Безлимит событий: баланс не списывается')
  })

  it('warns about dates left as drafts by the daily limit, on top of the balance note', () => {
    const note = seriesBalanceNote(
      preview({ published: 3, drafts: 1, dailyLimitDrafts: 1, balanceAfter: 7 }),
    )
    expect(note.tone).toBe('warning')
    expect(note.text).toContain('Спишется 3 события')
    expect(note.text).toContain('Из-за дневного лимита платформы черновиками останутся: 1.')
  })

  it('keeps the previous wording without the new fields (older preview answers)', () => {
    expect(seriesBalanceNote(preview()).text).toContain('Спишется 4 события')
  })
})
