import {
  PLATFORM_PURCHASE_REASON_MAX,
  PLATFORM_PURCHASE_REASON_MIN,
  type PlatformPurchaseMoneyTotal,
  type PlatformPurchaseRequestRow,
  type PlatformPurchaseStatus,
} from '@volley-time/shared'

import { pluralEvents } from './cabinet-shell'
import { entryDate } from './event-balance-billing'
import { formatMoneyRu } from './labels'

/** «Подписки и выплаты» Root Admin (22.2.3, R-04 в объёме D-07): заявки, решения, выгрузка. */
export const PURCHASES_API = '/api/platform/event-balance/purchase-requests'

export const PAYMENT_STATUS_LABELS: Record<PlatformPurchaseStatus, string> = {
  pending: 'Ждёт решения',
  approved: 'Подтверждена',
  rejected: 'Отклонена',
  cancelled: 'Отменена',
}

export const PAYMENT_PERIODS = [
  { key: 'month', label: 'Этот месяц' },
  { key: 'prev', label: 'Прошлый месяц' },
  { key: '30d', label: '30 дней' },
  { key: 'all', label: 'Всё время' },
] as const
export type PaymentPeriodKey = (typeof PAYMENT_PERIODS)[number]['key']

export interface PeriodRange {
  from?: string
  to?: string
}

/** Часовой пояс отчётов платформы — Europe/Minsk: UTC+3 без перехода на летнее время. */
const MINSK_OFFSET_MS = 3 * 3_600_000
export const PAYMENTS_TIMEZONE = 'Europe/Minsk'

/** Полночь минского дня (y, m, d) как момент времени; переполнение месяца/дня нормализуется. */
const minskMidnight = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m, d) - MINSK_OFFSET_MS).toISOString()

/**
 * Период `[from, to)` по минским суткам — одинаково на сервере и в браузере (SSR без расхождения),
 * как и время в выгрузке. «Всё время» — без границ.
 */
export function periodRange(key: PaymentPeriodKey, now = new Date()): PeriodRange {
  const local = new Date(now.getTime() + MINSK_OFFSET_MS)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const d = local.getUTCDate()
  if (key === 'month') return { from: minskMidnight(y, m, 1), to: minskMidnight(y, m + 1, 1) }
  if (key === 'prev') return { from: minskMidnight(y, m - 1, 1), to: minskMidnight(y, m, 1) }
  // 30 календарных дней, включая сегодня
  if (key === '30d') return { from: minskMidnight(y, m, d - 29), to: minskMidnight(y, m, d + 1) }
  return {}
}

/** Ссылка на CSV платежей за период (скачивание — обычный переход, сессия в cookie). */
export function exportHref(range: PeriodRange): string {
  const params = new URLSearchParams()
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)
  const qs = params.toString()
  return `${PURCHASES_API}/export${qs ? `?${qs}` : ''}`
}

export function rejectReasonError(reason: string): string | null {
  const value = reason.trim()
  if (!value) return 'Укажите причину отклонения'
  if (value.length < PLATFORM_PURCHASE_REASON_MIN)
    return `Причина — не короче ${PLATFORM_PURCHASE_REASON_MIN} символов`
  if (value.length > PLATFORM_PURCHASE_REASON_MAX)
    return `Причина — не длиннее ${PLATFORM_PURCHASE_REASON_MAX} символов`
  return null
}

export function decisionErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'purchase_request.not_pending':
      return 'Заявка уже обработана: список обновлён'
    case 'purchase_request.not_found':
      return 'Заявка не найдена'
    case 'platform.purchase_org_deleted':
      return 'Организация удалена: подтвердить заявку нельзя до восстановления'
    case 'validation_failed':
      return 'Проверьте поля формы'
    default:
      return 'Не удалось сохранить решение. Попробуйте ещё раз'
  }
}

export interface PaymentRowView {
  id: number
  organizationId: number
  organization: string
  requester: string
  units: string
  amount: string
  status: string
  statusKey: PlatformPurchaseStatus
  pending: boolean
  created: string
  createdIso: string
  decision: string
}

export function paymentRowView(row: PlatformPurchaseRequestRow, tz: string): PaymentRowView {
  const decisionParts = [row.decidedBy?.name, row.decisionComment].filter(Boolean)
  return {
    id: row.id,
    organizationId: row.organization.id,
    organization: row.organization.name,
    requester: row.requestedBy?.name ?? '',
    units: `+${row.units} ${pluralEvents(row.units)}`,
    amount: formatMoneyRu(row.amount, row.currency),
    status: PAYMENT_STATUS_LABELS[row.status],
    statusKey: row.status,
    pending: row.status === 'pending',
    created: entryDate(row.createdAt, tz),
    createdIso: row.createdAt,
    decision: decisionParts.join(': '),
  }
}

/** Сумма подтверждённых по валютам: «1 234,56 BYN · 10,00 RUB»; пусто — ноль. */
export function totalsLabel(totals: readonly PlatformPurchaseMoneyTotal[]): string {
  if (!totals.length) return formatMoneyRu(0, 'BYN')
  return totals.map((t) => formatMoneyRu(t.amount, t.currency)).join(' · ')
}
