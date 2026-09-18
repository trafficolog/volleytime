import {
  db as defaultDb,
  type DbOrTx,
  type Organization,
  type OrganizationMember,
} from '@volley-time/db'

import type { PendingNotification } from '../notifier/types'

/**
 * Контекст вызова доменного сервиса.
 * - userId — кто выполняет действие
 * - db — переопределяется транзакцией (tx) или в тестах
 * - organization/member — заполняются tenant middleware для org-scoped операций
 */
export interface ServiceContext {
  userId: number
  db?: DbOrTx
  /** Коллектор уведомлений (collect-then-notify): заполняется сервисами, шлётся после коммита. */
  notifications?: PendingNotification[]
  organization?: Organization
  member?: OrganizationMember
}

/** Получить активный DB/tx (транзакционный из ctx или дефолтный пул). */
export function getDb(ctx: ServiceContext): DbOrTx {
  return ctx.db ?? defaultDb
}

/** Выполнить fn в транзакции (вложенный вызов → savepoint), передав tx через ctx. */
export async function inTransaction<T>(
  ctx: ServiceContext,
  fn: (txCtx: ServiceContext) => Promise<T>,
): Promise<T> {
  return getDb(ctx).transaction((tx) => fn({ ...ctx, db: tx }))
}
