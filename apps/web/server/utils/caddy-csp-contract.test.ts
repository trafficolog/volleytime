import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const caddyfile = readFileSync(path.join(root, 'Caddyfile'), 'utf8')
const csp = /Content-Security-Policy\s+"([^"]+)"/.exec(caddyfile)?.[1] ?? ''
const directive = (name: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `))
    ?.split(/\s+/)
    .slice(1) ?? []

describe('Caddy CSP for the Telegram Login popup flow (20.5.1)', () => {
  it('is present and never allows eval', () => {
    expect(csp).not.toBe('')
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).not.toContain('wasm-unsafe-eval')
  })

  it('loads the widget script only from telegram.org', () => {
    expect(directive('script-src')).toContain('https://telegram.org')
  })

  it('allows the oauth.telegram.org fallback XHR (connect-src) and keeps the rest closed', () => {
    expect(directive('connect-src')).toEqual(["'self'", 'https://oauth.telegram.org'])
  })

  it('does not need frame-src: the popup flow embeds no iframe', () => {
    expect(directive('frame-src')).toEqual([])
  })

  it('still lets only Telegram embed the Mini App', () => {
    expect(directive('frame-ancestors')).toContain('https://web.telegram.org')
  })
})
