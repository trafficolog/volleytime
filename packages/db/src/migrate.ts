import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.join(currentDir, '../migrations')

/** Программно применить все pending миграции. Используется в CI и тестах. */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const migrationClient = postgres(databaseUrl, { max: 1 })
  const migrationDb = drizzle(migrationClient)
  await migrate(migrationDb, { migrationsFolder })
  await migrationClient.end()
}

// CLI entrypoint: node dist/migrate.js
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  runMigrations(url)
    .then(() => {
      console.log('Migrations applied.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Migration failed:', err)
      process.exit(1)
    })
}
