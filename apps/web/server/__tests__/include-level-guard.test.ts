import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Guard 20.6.1 / 20.4.10 (решение владельца 2026-10-14): уровни игроков в составе события видят
 * только участники группы. Опция `includeLevel` разрешена в `server/api` лишь на маршруте участников
 * группы; публичные маршруты (`api/public/**`) и любые новые не должны её использовать.
 */
const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../api')

/** Единственный разрешённый маршрут: состав события для участников группы. */
export const INCLUDE_LEVEL_ALLOWLIST = ['organizations/[orgId]/events/[eventId]/index.get.ts']

export function findIncludeLevelUsages(dir: string, root = dir): string[] {
  const hits: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) hits.push(...findIncludeLevelUsages(full, root))
    else if (/\.(ts|js|mjs|vue)$/.test(entry.name) && !entry.name.includes('.test.'))
      if (readFileSync(full, 'utf8').includes('includeLevel'))
        hits.push(path.relative(root, full).replaceAll('\\', '/'))
  }
  return hits.sort()
}

describe('includeLevel allowlist (20.6.1)', () => {
  it('server/api uses includeLevel only on the group-members event route', () => {
    expect(findIncludeLevelUsages(API_DIR)).toEqual(INCLUDE_LEVEL_ALLOWLIST)
  })

  it('the public route does not read the roster with a level', () => {
    const publicDir = path.join(API_DIR, 'public')
    expect(findIncludeLevelUsages(publicDir)).toEqual([])
  })

  it('the scanner catches a new usage outside the allowlist (the guard can fail)', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'vt-guard-'))
    try {
      mkdirSync(path.join(tmp, 'public/events'), { recursive: true })
      writeFileSync(
        path.join(tmp, 'public/events/[slug].get.ts'),
        'await bookingService.publicRoster(ctx, 1, 2, { includeLevel: true })',
      )
      writeFileSync(path.join(tmp, 'ok.get.ts'), 'export default 1')
      expect(findIncludeLevelUsages(tmp)).toEqual(['public/events/[slug].get.ts'])
      expect(findIncludeLevelUsages(tmp)).not.toEqual(INCLUDE_LEVEL_ALLOWLIST)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
