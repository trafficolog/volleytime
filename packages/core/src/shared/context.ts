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

/**
 * Системный автор фоновых задач (планировщик 20.3.1): пользователя нет, в audit_log пишется
 * `user_id = NULL`. Не является id реального пользователя (serial начинается с 1).
 */
export const SYSTEM_USER_ID = 0

/** Контекст системной операции планировщика. */
export function systemContext(db?: DbOrTx): ServiceContext {
  return { userId: SYSTEM_USER_ID, ...(db ? { db } : {}) }
}

/** Автор для FK на users: NULL у системной операции. */
export function actorUserId(ctx: ServiceContext): number | null {
  return ctx.userId === SYSTEM_USER_ID ? null : ctx.userId
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
