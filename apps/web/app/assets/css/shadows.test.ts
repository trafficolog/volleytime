import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const assets = new URL('.', import.meta.url)
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('./main.css', import.meta.url), 'utf8')

describe('decorative elevation contract', () => {
  it('removes accent elevation from shared buttons and every accent-token consumer', () => {
    expect(tokens.match(/--vt-shadow-accent:\s*([^;]+);/)?.[1]).toBe('none')
    expect(main.match(/\.vt-btn--primary\s*\{([^}]+)\}/)?.[1]).not.toContain('box-shadow')
  })

  it('rejects blue RGBA elevation across local CSS and Vue styles', () => {
    function audit(directory: string): string[] {
      return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) return audit(path)
        if (!/\.(css|vue)$/.test(path)) return []
        const source = readFileSync(path, 'utf8')
        return [...source.matchAll(/(?:box-shadow|--[\w-]*shadow[\w-]*):\s*([^;]+);/g)]
          .filter((declaration) =>
            [...declaration[1]!.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)].some(
              ([, r, g, b]) => Number(b) > Number(r) + 30 && Number(b) > Number(g) + 30,
            ),
          )
          .map((declaration) => `${path}: ${declaration[0]}`)
      })
    }
    expect(audit(fileURLToPath(new URL('../..', assets)))).toEqual([])
  })

  it('preserves neutral elevation and the explicit keyboard focus ring', () => {
    expect(tokens).toMatch(/--vt-shadow-card:\s*0 1px 2px rgba/)
    expect(tokens).toMatch(/--vt-shadow-float:\s*0 14px 32px/)
    expect(main).toMatch(/\.vt-field:focus-visible\s*\{[^}]*box-shadow: 0 0 0 3px var\(--vt-ring\)/)
    expect(main).toMatch(
      /:is\(button, a, input, select, textarea, \[tabindex\]\):focus-visible\s*\{[^}]*outline:/,
    )
  })
})
