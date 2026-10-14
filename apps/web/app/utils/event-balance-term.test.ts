import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// Единый термин «баланс событий» (D-10, карточка 19.1.4): «credit» не попадает в исходники приложения и бота.
const roots = [
  fileURLToPath(new URL('../', import.meta.url)),
  fileURLToPath(new URL('../../../bot/src/', import.meta.url)),
]
const forbidden = /\bcredits?\b/i

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    const isSource = /\.(vue|ts|tsx|js|mjs)$/.test(name)
    const isTest = /\.(test|spec)\.ts$/.test(name)
    return isSource && !isTest ? [path] : []
  })
}

describe('термин «баланс событий» вместо credits (D-10)', () => {
  it('не содержит «credit» в исходниках приложения и бота', () => {
    const hits = roots.flatMap((root) =>
      sourceFiles(root).flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .filter((line) => forbidden.test(line))
          .map((line) => `${file}: ${line.trim()}`),
      ),
    )
    expect(hits).toEqual([])
  })
})
