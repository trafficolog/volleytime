import { describe, expect, it } from 'vitest'

import { canSubmitDesktopEventAction } from './desktop-event-actions'

describe('desktop event action boundary', () => {
  const expected = '/app/orgs/7/events/9'

  it('permits only a live, idle event route', () => {
    expect(canSubmitDesktopEventAction(expected, expected, false)).toBe(true)
    expect(canSubmitDesktopEventAction(`${expected}/edit`, expected, false)).toBe(false)
    expect(canSubmitDesktopEventAction('/app/orgs/8/events/9', expected, false)).toBe(false)
    expect(canSubmitDesktopEventAction(expected, expected, true)).toBe(false)
  })
})
