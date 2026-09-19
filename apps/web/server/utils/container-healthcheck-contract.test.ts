import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const composePath = fileURLToPath(new URL('../../../../docker-compose.prod.yml', import.meta.url))

function serviceSection(compose: string, service: string, nextService: string): string {
  const start = compose.indexOf(`\n  ${service}:`)
  const end = compose.indexOf(`\n  ${nextService}:`, start)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return compose.slice(start, end)
}

describe('production container healthchecks', () => {
  it('uses the IPv4 loopback address used by the Node listeners', () => {
    const compose = readFileSync(composePath, 'utf8')
    const web = serviceSection(compose, 'web', 'bot')
    const bot = serviceSection(compose, 'bot', 'postgres')

    expect(web).toContain('http://127.0.0.1:3000/api/health')
    expect(bot).toContain('http://127.0.0.1:3001/healthz')
    expect(web).not.toContain('http://localhost:')
    expect(bot).not.toContain('http://localhost:')
  })
})
