export { db, closeDb, type DB, type Transaction, type DbOrTx } from './client'
export { runMigrations } from './migrate'
export * from './schema'
export * from './event-balance'
// решения root по заявкам на покупку баланса: одна логика у операторской команды и Root Admin (22.2.3)
export {
  approvePurchaseRequest,
  rejectPurchaseRequest,
  OperatorError,
} from './event-balance-operations'

// re-export часто используемых операторов (единая точка, без прямой зависимости потребителей от drizzle-orm)
export {
  eq,
  and,
  or,
  ne,
  sql,
  inArray,
  notInArray,
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
