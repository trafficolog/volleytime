import type { EventListItem } from '../components/EventCard.vue'
import type { TabItem } from '../components/vt/TabBar.vue'

import { ROLE_LABELS } from './labels'

interface Member {
  role: string
  status: string
}

interface MenuLink {
  to: string
  label: string
}

export interface OrganizerBalance {
  currency: string
  income: number
  expense: number
  balance: number
  byCurrency: Record<string, { income: number; expense: number; balance: number }>
}

interface OrganizerHomeDashboard {
  isManager: boolean
  upcoming: EventListItem[]
  manager: { pendingCount: number; balance: OrganizerBalance } | null
}

export function organizerHomeSubtitle(
  routeOrgId: number,
  organization: { id: number; city: string | null } | null,
  member: (Member & { organizationId: number }) | null,
): string | undefined {
  if (!organization || organization.id !== routeOrgId) return undefined

  const city = organization.city?.trim() ?? ''
  const role =
    member?.organizationId === routeOrgId &&
    member.status === 'active' &&
    ['owner', 'organizer'].includes(member.role)
      ? ROLE_LABELS[member.role]
      : null
  return [city, role].filter(Boolean).join(' · ') || undefined
}

export function projectOrganizerHome(
  routeOrgId: number,
  organization: { id: number } | null,
  member: Member | null,
  dashboard: OrganizerHomeDashboard | null,
) {
  if (
    !Number.isSafeInteger(routeOrgId) ||
    routeOrgId <= 0 ||
    organization?.id !== routeOrgId ||
    member?.status !== 'active' ||
    !['owner', 'organizer'].includes(member.role) ||
    !dashboard?.isManager ||
    !dashboard.manager
  ) {
    return null
  }

  return {
    balance: dashboard.manager.balance,
    pendingCount: dashboard.manager.pendingCount,
    nextEvent: dashboard.upcoming.find((event) => event.status !== 'cancelled') ?? null,
    upcoming: dashboard.upcoming,
  }
}

export function organizerMenuLinks(
  base: string,
  member: Member | null | undefined,
  subscriptionsEnabled: boolean,
): MenuLink[] {
  if (member?.status !== 'active' || !['owner', 'organizer'].includes(member.role)) return []

  return [
    { to: `${base}/events/new`, label: 'Создать событие' },
    { to: `${base}/invite`, label: 'Пригласить' },
    ...(subscriptionsEnabled ? [{ to: `${base}/plans`, label: 'Планы' }] : []),
    ...(member.role === 'owner' ? [{ to: `${base}/settings`, label: 'Настройки' }] : []),
    { to: `${base}/audit`, label: 'Журнал' },
  ]
}

export function organizerTabItems(base: string): TabItem[] {
  return [
    { kind: 'link', to: base, label: 'События', icon: 'calendar' },
    { kind: 'link', to: `${base}/members`, label: 'Игроки', icon: 'users' },
    { kind: 'link', to: `${base}/cashbox`, label: 'Касса', icon: 'chart' },
    { kind: 'link', to: `${base}/payments`, label: 'Оплаты', icon: 'wallet' },
    { kind: 'action', id: 'menu', label: 'Меню', icon: 'menu' },
  ]
}

export function playerTabItems(base: string, showSubscriptions: boolean): TabItem[] {
  return [
    { kind: 'link', to: base, label: 'Главная', icon: 'home' },
    { kind: 'link', to: `${base}/events`, label: 'События', icon: 'calendar', prefix: true },
    { kind: 'link', to: `${base}/bookings`, label: 'Записи', icon: 'ticket' },
    ...(showSubscriptions
      ? [{ kind: 'link' as const, to: `${base}/subscriptions`, label: 'Абонементы', icon: 'card' }]
      : []),
  ]
}

export function pendingPaymentsForEvent<T extends { event?: { id: number } | null }>(
  payments: readonly T[],
  eventId: number,
): T[] {
  return payments.filter((payment) => payment.event?.id === eventId)
}
