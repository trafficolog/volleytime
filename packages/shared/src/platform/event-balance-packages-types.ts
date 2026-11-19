/**
 * Каталог пакетов баланса событий в Root Admin (22.2.1, ADR-22-2-1): форма ответов
 * `/api/platform/event-balance/packages`. Суммы — minor units.
 */

export const EVENT_BALANCE_PACKAGE_BADGE_VALUES = ['popular', 'discount', 'best_price'] as const
export type EventBalancePackageBadgeValue = (typeof EVENT_BALANCE_PACKAGE_BADGE_VALUES)[number]

/** Подтверждённые заявки в одной валюте: «продано» — число заявок, «выручка» — сумма снимков. */
export interface PlatformPackageSales {
  currency: string
  sold: number
  revenue: number
}

export interface PlatformEventBalancePackage {
  id: number
  code: string
  units: number
  amount: number
  currency: string
  badge: EventBalancePackageBadgeValue | null
  visible: boolean
  archivedAt: string | null
  sortOrder: number
  /** Токен оптимистичной блокировки: передаётся в PATCH и архив. */
  version: number
  createdAt: string
  updatedAt: string
  /** `amount / units`, округление half-up до целого minor unit. */
  pricePerEvent: number
  sales: PlatformPackageSales[]
}

export interface PlatformEventBalancePackages {
  packages: PlatformEventBalancePackage[]
  /** Подтверждённые заявки, не отнесённые ни к одному пакету («Без пакета (до каталога)»). */
  unattributed: PlatformPackageSales[]
}

export type PlatformPackageHistoryAction =
  | 'event_balance_package.created'
  | 'event_balance_package.updated'
  | 'event_balance_package.visibility_changed'
  | 'event_balance_package.archived'

export interface PlatformPackageHistoryEntry {
  id: number
  createdAt: string
  action: PlatformPackageHistoryAction
  packageId: number
  /** Код пакета из каталога; `null`, если строка пакета недоступна. */
  packageCode: string | null
  actor: { id: number; name: string; email: string | null } | null
  oldValue: unknown
  newValue: unknown
}

export interface PlatformPackageHistoryPage {
  entries: PlatformPackageHistoryEntry[]
  /** id последней записи страницы; `null` — страниц больше нет. */
  nextCursor: number | null
}
