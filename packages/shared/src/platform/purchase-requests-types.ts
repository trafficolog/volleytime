/**
 * Заявки организаций на покупку баланса событий в Root Admin (22.2.3, R-04 в объёме D-07):
 * реестр, ручное подтверждение и отклонение, выгрузка платежей за период. Онлайн-оплаты, выплат,
 * возвратов и сверки с платёжным провайдером нет до фазы 12. Деньги — в минорных единицах.
 */

export const PLATFORM_PURCHASE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type PlatformPurchaseStatus = (typeof PLATFORM_PURCHASE_STATUSES)[number]

export const PLATFORM_PURCHASE_REASON_MIN = 3
export const PLATFORM_PURCHASE_REASON_MAX = 500

export interface PlatformPurchaseRequestRow {
  id: number
  organization: { id: number; name: string }
  /** Снимок заявки: количество событий, цена и валюта на момент заявки. */
  units: number
  amount: number
  currency: string
  status: PlatformPurchaseStatus
  createdAt: string
  decidedAt: string | null
  /** Кто решил (root); без email и телефона. */
  decidedBy: { id: number; name: string } | null
  /** Комментарий подтверждения или причина отклонения. */
  decisionComment: string | null
  /** Имя автора заявки (организатор), без контактов. */
  requestedBy: { id: number; name: string } | null
}

export interface PlatformPurchaseRequestsPage {
  items: PlatformPurchaseRequestRow[]
  /** id последней заявки страницы; `null` — страниц больше нет. */
  nextCursor: number | null
}

export interface PlatformPurchaseMoneyTotal {
  currency: string
  /** Сумма подтверждённых заявок за период, минорные единицы. */
  amount: number
  count: number
  units: number
}

export interface PlatformPurchaseOrgRevenue {
  organization: { id: number; name: string }
  currency: string
  amount: number
  units: number
  count: number
}

export interface PlatformPurchaseSummary {
  from: string | null
  to: string | null
  /** Подтверждённые за период (по дате решения), по валютам. */
  approved: PlatformPurchaseMoneyTotal[]
  /** Заявки, ждущие решения сейчас (без учёта периода). */
  pendingCount: number
  /** Отклонённые за период. */
  rejectedCount: number
  payingOrganizations: number
  /**
   * Сверка с журналом баланса: события в подтверждённых заявках периода и начисления `purchase`
   * журнала за тот же период. `matches` — суммы и число записей равны.
   */
  ledger: { approvedUnits: number; ledgerUnits: number; ledgerEntries: number; matches: boolean }
  byOrganization: PlatformPurchaseOrgRevenue[]
}

export interface PlatformPurchaseDecisionResult {
  request: PlatformPurchaseRequestRow
  /** Остаток баланса организации после подтверждения; `null` — отклонение. */
  balanceAfter: number | null
}
