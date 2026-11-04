import type { ManagerOverview, OverviewPendingPayment } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import { pluralRu } from '~/utils/desktop-players'
import { formatMoneyRu } from '~/utils/labels'

export interface DashboardResponse {
  isManager: boolean
  upcoming: EventListItem[]
  manager: {
    pendingCount: number
    pendingAmount: number
    balance: { currency: string; balance: number }
  } | null
  /** Агрегаты обзора W-02 (21.2.18); только управляющему. */
  overview?: ManagerOverview
}

export interface DesktopDashboardView {
  balance: { currency: string; balance: number }
  upcoming: EventListItem[]
  overview: ManagerOverview
}

export function desktopDashboardView(data: DashboardResponse | null): DesktopDashboardView | null {
  if (!data?.isManager || !data.manager || !data.overview) return null
  return {
    balance: data.manager.balance,
    upcoming: data.upcoming,
    overview: data.overview,
  }
}

/** Заполненность как отдал API; `null` (нет вместимости) — тире. */
export function formatOccupancy(percent: number | null): string {
  return percent === null ? '—' : `${percent}%`
}

/** Сумма со знаком для кассы: «+82,50 BYN», «-40,00 BYN», ноль без знака. */
function signedMoney(minor: number, currency: string): string {
  return `${minor > 0 ? '+' : ''}${formatMoneyRu(minor, currency)}`
}

export function pendingPaymentTitle(item: OverviewPendingPayment): string {
  if (item.user.name) return item.user.name
  if (item.user.telegramUsername) return `@${item.user.telegramUsername}`
  return 'Игрок'
}

export function pendingPaymentMeta(item: OverviewPendingPayment): string {
  const source = item.event?.title ?? item.plan?.name ?? item.collection?.title ?? 'Без привязки'
  return item.seats > 1
    ? `${source} · ${item.seats} ${pluralRu(item.seats, 'место', 'места', 'мест')}`
    : source
}

export interface CashWeekBar {
  from: string
  value: string
  heightPercent: number
  current: boolean
}

export interface CashChartView {
  /** Заголовок графика: сумма `total.net` за 4 недели. */
  headline: string
  bars: CashWeekBar[]
}

/** График и заголовок «Касса за 4 недели» строятся по `net` (решение владельца 2026-11-05). */
export function overviewCashChart(cash: ManagerOverview['cashWeekly']): CashChartView {
  const maxAbs = Math.max(0, ...cash.weeks.map((week) => Math.abs(week.net)))
  return {
    headline: signedMoney(cash.total.net, cash.currency),
    bars: cash.weeks.map((week, index) => ({
      from: week.from,
      value: signedMoney(week.net, cash.currency),
      heightPercent: maxAbs === 0 ? 0 : Math.round((Math.abs(week.net) / maxAbs) * 100),
      current: index === cash.weeks.length - 1,
    })),
  }
}
