import type { EventListItem } from '~/components/EventCard.vue'

export interface DashboardResponse {
  isManager: boolean
  upcoming: EventListItem[]
  manager: {
    pendingCount: number
    pendingAmount: number
    balance: { currency: string; balance: number }
  } | null
}

export interface DesktopDashboardView {
  balance: { currency: string; balance: number }
  pendingCount: number
  pendingAmount: number
  upcoming: EventListItem[]
}

export function desktopDashboardView(data: DashboardResponse | null): DesktopDashboardView | null {
  if (!data?.isManager || !data.manager) return null
  return {
    balance: data.manager.balance,
    pendingCount: data.manager.pendingCount,
    pendingAmount: data.manager.pendingAmount,
    upcoming: data.upcoming,
  }
}
