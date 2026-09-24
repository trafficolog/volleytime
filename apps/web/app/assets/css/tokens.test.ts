import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const tailwind = readFileSync(new URL('../../../tailwind.config.ts', import.meta.url), 'utf8')
const nuxt = readFileSync(new URL('../../../nuxt.config.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('./main.css', import.meta.url), 'utf8')

function declarations(selector: ':root' | '.dark'): Record<string, string> {
  const escaped =
    selector === '.dark' ? '(?:\\.dark\\s*,\\s*\\.vt-dark|\\.dark|\\.vt-dark)' : ':root'
  const blocks = [...tokens.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
  const result: Record<string, string> = {}
  for (const block of blocks) {
    const body = block[1]
    if (!body) continue
    for (const declaration of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      const [, name, value] = declaration
      if (name && value) result[name] = value.trim()
    }
  }
  return result
}

describe('Bento Bold design token contract', () => {
  it('uses the final light palette instead of the old warm reference layer', () => {
    expect(declarations(':root')).toMatchObject({
      '--vt-paper': '#ffffff',
      '--vt-bone': '#f4f4f6',
      '--vt-bone-2': '#ececf0',
      '--vt-ink': '#15161a',
      '--vt-mute': '#6a6b73',
      '--vt-flame': '#2437c9',
      '--vt-flame-deep': '#1a2aa3',
      '--vt-orange-soft': '#ffe9dc',
      '--vt-blue-soft-tile': '#e8ebff',
    })
  })

  it('exposes the final type and spacing roles without conflating numbers and code', () => {
    expect(declarations(':root')).toMatchObject({
      '--f-display': "'Oswald', 'Golos Text', system-ui, sans-serif",
      '--f-body': "'Golos Text', system-ui, sans-serif",
      '--f-num': "'Oswald', 'Golos Text', system-ui, sans-serif",
      '--f-mono': "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      '--r-card': '20px',
      '--r-btn': '14px',
      '--s-4': '16px',
    })
    expect(nuxt).toContain('family=Oswald')
    expect(nuxt).toContain('family=Golos+Text')
    expect(nuxt).not.toMatch(/Space\+Grotesk|family=Manrope/)
    expect(tailwind).toContain("display: ['var(--f-display)']")
    expect(tailwind).toContain("body: ['var(--f-body)']")
    expect(tailwind).toContain("num: ['var(--f-num)']")
    expect(main).toContain('font-family: var(--f-num)')
  })

  it('keeps a deliberate dark palette and semantic success/danger roles', () => {
    expect(declarations('.dark')).toMatchObject({
      '--vt-paper': '#0f1013',
      '--vt-ink': '#f2f2f5',
    })
    expect(declarations(':root')).toMatchObject({
      '--vt-grass': '#456f34',
      '--vt-rose': '#be2f3f',
    })
  })
})
