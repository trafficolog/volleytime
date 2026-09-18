export { db, closeDb, type DB, type Transaction, type DbOrTx } from './client'
export { runMigrations } from './migrate'
export * from './schema'

// re-export часто используемых операторов (единая точка, без прямой зависимости потребителей от drizzle-orm)
export {
  eq,
  and,
  or,
  ne,
  sql,
  inArray,
  desc,
  asc,
  gte,
  lte,
  lt,
  gt,
  isNull,
  isNotNull,
} from 'drizzle-orm'

// алиасы таблиц для self-join (6.8.12)
export { alias } from 'drizzle-orm/pg-core'
