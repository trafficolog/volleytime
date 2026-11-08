import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { isReservedShortLink, RESERVED_SHORT_LINKS } from '@volley-time/core'
import { describe, expect, it } from 'vitest'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Верхнеуровневые имена: `pages/<имя>` (папка или `<имя>.vue`), `public/<имя>`, `server/api/<имя>`. */
function topLevelNames(): string[] {
  const names = new Set<string>()
  for (const dir of ['app/pages', 'public', 'server/api']) {
    for (const entry of readdirSync(path.join(webRoot, dir))) {
      const name = entry.replace(/\.(vue|ts|ico|txt|xml|json|png|svg)$/, '').replace(/\.get$/, '')
      if (name && name !== 'index' && !name.includes('.')) names.add(name.toLowerCase())
    }
  }
  return [...names]
}

/** Task 21.2.16: короткая ссылка не должна совпасть с верхнеуровневым маршрутом приложения. */
describe('reserved short links cover the top-level routes', () => {
  it('reserves every top-level page, static and api name', () => {
    const missing = topLevelNames().filter((name) => !isReservedShortLink(name))
    expect(missing, `добавьте в RESERVED_SHORT_LINKS: ${missing.join(', ')}`).toEqual([])
  })

  it('reserves the words fixed by the owner on 2026-11-08', () => {
    for (const word of ['app', 'm', 'api', 'admin', 'login']) {
      expect(RESERVED_SHORT_LINKS).toContain(word)
    }
  })
})
