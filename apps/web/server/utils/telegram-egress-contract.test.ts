import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const composePath = fileURLToPath(new URL('../../../../docker-compose.prod.yml', import.meta.url))

describe('Telegram production egress contract', () => {
  it('gives the bot a dual-stack backend and prefers Telegram IPv6', () => {
    const compose = readFileSync(composePath, 'utf8')
    const botStart = compose.indexOf('\n  bot:')
    const botEnd = compose.indexOf('\n  postgres:', botStart)
    const bot = compose.slice(botStart, botEnd)

    expect(botStart).toBeGreaterThan(-1)
    expect(botEnd).toBeGreaterThan(botStart)
    expect(bot).toContain('NODE_OPTIONS: --dns-result-order=ipv6first')
    expect(compose).toMatch(/\n {2}backend:\r?\n {4}enable_ipv6: true/)
  })
})
