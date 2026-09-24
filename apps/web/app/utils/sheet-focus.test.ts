import { describe, expect, it } from 'vitest'

import { nextSheetFocus } from './sheet-focus'

const first = { id: 'first' } as HTMLElement
const middle = { id: 'middle' } as HTMLElement
const last = { id: 'last' } as HTMLElement
const focusables = [first, middle, last]

describe('sheet keyboard focus', () => {
  it('wraps forward from the last control to the first', () => {
    expect(nextSheetFocus(focusables, last, false)).toBe(first)
  })

  it('wraps backward from the first control to the last', () => {
    expect(nextSheetFocus(focusables, first, true)).toBe(last)
  })

  it('keeps native Tab inside the middle of the sheet', () => {
    expect(nextSheetFocus(focusables, middle, false)).toBeNull()
  })

  it('moves focus inside when it unexpectedly starts outside', () => {
    expect(nextSheetFocus(focusables, null, false)).toBe(first)
    expect(nextSheetFocus(focusables, null, true)).toBe(last)
  })
})
