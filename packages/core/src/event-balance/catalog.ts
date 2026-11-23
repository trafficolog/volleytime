import {
  and,
  asc,
  db as defaultDb,
  eq,
  eventBalancePackages,
  isNull,
  type DbOrTx,
  type EventBalancePackageBadge,
} from '@volley-time/db'

export interface EventBalanceCatalogPackage {
  code: string
  units: number
  amount: number
  currency: string
  badge: EventBalancePackageBadge | null
}

/**
 * Витрина каталога баланса событий (ADR-22-2-1): видимые неархивные пакеты в порядке Root Admin.
 * Общий источник кабинета (`eventBalanceService.get`) и публичного лендинга (24.1.4, D-11, без входа и контекста).
 */
export async function readEventBalanceCatalog(
  db: DbOrTx = defaultDb,
): Promise<EventBalanceCatalogPackage[]> {
  return db
    .select({
      code: eventBalancePackages.code,
      units: eventBalancePackages.units,
      amount: eventBalancePackages.amount,
      currency: eventBalancePackages.currency,
      badge: eventBalancePackages.badge,
    })
    .from(eventBalancePackages)
    .where(and(eq(eventBalancePackages.visible, true), isNull(eventBalancePackages.archivedAt)))
    .orderBy(
      asc(eventBalancePackages.sortOrder),
      asc(eventBalancePackages.units),
      asc(eventBalancePackages.id),
    )
}
