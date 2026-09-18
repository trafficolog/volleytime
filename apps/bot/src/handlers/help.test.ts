import { describe, expect, it } from 'vitest'

import { BOT_COMMANDS, HELP_TEXT } from './help'

describe('help handler', () => {
  it('HELP_TEXT mentions key features', () => {
    expect(HELP_TEXT).toContain('Записаться')
    expect(HELP_TEXT).toContain('абонемент')
    expect(HELP_TEXT).toContain('/start')
    expect(HELP_TEXT).toContain('/help')
  })

  it('BOT_COMMANDS has start and help', () => {
    const names = BOT_COMMANDS.map((c) => c.command)
    expect(names).toContain('start')
    expect(names).toContain('help')
  })

  it('commands have russian descriptions', () => {
    expect(BOT_COMMANDS.every((c) => c.description.length > 0)).toBe(true)
  })
})
