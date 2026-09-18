import { describe, expect, it } from 'vitest'

import { themeVariables } from './useTelegram'

describe('Telegram theme mapping (8.8.4)', () => {
  it('maps themeParams to design tokens and keeps --tg-* aliases', () => {
    const vars = themeVariables({
      bg_color: '#17212b',
      secondary_bg_color: '#232e3c',
      text_color: '#f5f5f5',
      button_color: '#5288c1',
      hint_color: '',
    })
    expect(vars['--vt-paper']).toBe('#17212b')
    expect(vars['--vt-bone']).toBe('#232e3c')
    expect(vars['--vt-bone-2']).toBe('#232e3c')
    expect(vars['--vt-ink']).toBe('#f5f5f5')
    expect(vars['--vt-flame']).toBe('#5288c1')
    expect(vars['--tg-bg-color']).toBe('#17212b')
    expect(vars['--vt-mute']).toBeUndefined()
  })

  it('does not override semantic colors', () => {
    const vars = themeVariables({ bg_color: '#fff', button_color: '#000' })
    expect(Object.keys(vars).some((k) => /grass|rose|amber/.test(k))).toBe(false)
  })
})
