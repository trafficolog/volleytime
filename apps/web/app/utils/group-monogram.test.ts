import { describe, expect, it } from 'vitest'

import { groupMonogram } from './group-monogram'

describe('group monogram (M-04 placeholder logo)', () => {
  it('takes the initials of the first two words, ignoring separators and quotes', () => {
    expect(groupMonogram('VolleyTime Минск').initials).toBe('VМ')
    expect(groupMonogram('МинскВолей · Воскресные').initials).toBe('МВ')
    expect(groupMonogram('«Спайк» Клуб').initials).toBe('СК')
  })

  it('returns a single letter for a one-word name', () => {
    expect(groupMonogram('Спайк').initials).toBe('С')
  })

  it('keeps the same tint for the same name and only uses token classes', () => {
    const first = groupMonogram('VolleyTime Минск')
    expect(groupMonogram('VolleyTime Минск')).toEqual(first)
    expect(first.className).toMatch(/^bg-vt-[a-z-]+ text-vt-[a-z-]+$/)
  })
})
