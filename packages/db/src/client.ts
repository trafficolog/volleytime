import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { env } from './env'
import * as schema from './schema'

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(queryClient, {
  schema,
  logger: process.env.NODE_ENV === 'development',
})

export type DB = typeof db

/** Закрыть пул соединений (для graceful shutdown и завершения тестов). */
export async function closeDb(): Promise<void> {
  await queryClient.end()
}

/** Тип аргумента callback транзакции (tx). */
export type Transaction = Parameters<Parameters<DB['transaction']>[0]>[0]
/** DB или транзакция — для сервисов, работающих и в tx, и вне. */
export type DbOrTx = DB | Transaction
