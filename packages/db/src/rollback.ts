import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import postgres from 'postgres'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(currentDir, '../migrations')
const rollbackDir = path.join(currentDir, '../rollback')

interface JournalEntry {
  idx: number
  when: number
  tag: string
}

/**
 * Откатить последнюю применённую миграцию (Task 3.9.11).
 * drizzle-kit не генерирует down-миграции: откат выполняется SQL-файлом
 * `packages/db/rollback/<tag>.sql`. Без файла — ошибка (исторические миграции
 * до 0012 откатываются восстановлением из бэкапа, см. runbook disaster-recovery).
 */
export async function rollbackLastMigration(databaseUrl: string): Promise<string> {
  const journal = JSON.parse(
    await readFile(path.join(migrationsDir, 'meta/_journal.json'), 'utf8'),
  ) as { entries: JournalEntry[] }

  const sql = postgres(databaseUrl, { max: 1 })
  try {
    const [last] = await sql<{ id: number; created_at: string }[]>`
      SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1`
    if (!last) throw new Error('No applied migrations')

    const entry = journal.entries.find((e) => String(e.when) === String(last.created_at))
    if (!entry) throw new Error(`Applied migration ${last.created_at} not found in journal`)

    let down: string
    try {
      down = await readFile(path.join(rollbackDir, `${entry.tag}.sql`), 'utf8')
    } catch {
      throw new Error(`No rollback script for ${entry.tag} (expected rollback/${entry.tag}.sql)`)
    }

    await sql.begin(async (tx) => {
      await tx.unsafe(down)
      await tx`DELETE FROM drizzle.__drizzle_migrations WHERE id = ${last.id}`
    })
    return entry.tag
  } finally {
    await sql.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  rollbackLastMigration(url)
    .then((tag) => {
      console.log(`Rolled back: ${tag}`)
      process.exit(0)
    })
    .catch((err) => {
      console.error('Rollback failed:', err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
