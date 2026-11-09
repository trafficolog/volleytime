import { eq, organizations, sql, type DbOrTx } from '@volley-time/db'

type SqlOperand = Parameters<typeof sql>[1]

/**
 * Условие «группа не удалена» (21.2.17) для запросов вне tenant middleware: фоновые задачи,
 * бот, публичные страницы и приглашения. `organizationId` — колонка или выражение с id группы.
 */
export const orgNotDeletedSql = (organizationId: SqlOperand) =>
  sql`NOT EXISTS (SELECT 1 FROM ${organizations} deleted_org
    WHERE deleted_org.id = ${organizationId} AND deleted_org.deleted_at IS NOT NULL)`

/**
 * Удалена ли группа, с разделяемой блокировкой её строки (`FOR SHARE`) до конца транзакции.
 * Удаление берёт `FOR UPDATE` той же строки, поэтому фоновый шаг, проверивший группу здесь, не
 * пересечётся с удалением: либо удаление ждёт конца шага, либо шаг видит уже удалённую группу.
 */
export async function isOrgDeletedLocked(tx: DbOrTx, organizationId: number): Promise<boolean> {
  const [row] = await tx
    .select({ deletedAt: organizations.deletedAt })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .for('share')
  return !row || row.deletedAt !== null
}
