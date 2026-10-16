import type { EventListItem } from '../components/EventCard.vue'

import { participationOf, pendingLabel } from './status-model'

const DENIED_ORG_ERRORS = new Set([
  'permission.blocked',
  'permission.not_member',
  'permission.no_longer_member',
])

export function isDeniedOrgError(code?: string) {
  return code !== undefined && DENIED_ORG_ERRORS.has(code)
}

export function playerAccessFromApiError(code?: string): 'pending' | 'suspended' | 'denied' | null {
  if (code === 'forbidden.pending_approval') return 'pending'
  if (code === 'organization.suspended') return 'suspended'
  if (isDeniedOrgError(code)) return 'denied'
  return null
}

export function playerHomeAccess(
  orgId: number,
  organization: { id: number; status: string } | null,
  member: { status: string } | null,
  errorCode?: string,
) {
  const errorAccess = playerAccessFromApiError(errorCode)
  if (errorAccess) return errorAccess
  if (!organization || organization.id !== orgId) return 'loading'
  if (organization.status === 'suspended') return 'suspended'
  if (member?.status === 'pending') return 'pending'
  return member?.status === 'active' ? 'active' : 'denied'
}

export function projectPlayerHome(
  upcoming: readonly EventListItem[],
  now: Date,
  /** Hero, выбранный сервером (ближайшая игра, на которую иду; может быть вне списка). */
  serverHero: EventListItem | null = null,
) {
  const events = upcoming
    .filter((event) => event.status === 'published' && new Date(event.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  // Референс: hero — ближайшая игра, на которую игрок идёт; иначе ближайшая опубликованная.
  const hero =
    serverHero ??
    events.find((event) => participationOf(event.myBooking)?.key === 'going') ??
    events[0] ??
    null

  return { hero, schedule: events.filter((event) => event.id !== hero?.id) }
}

export function playerGreeting(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0]
  return first ? `Привет, ${first}` : null
}

/**
 * Плитка «Сессий осталось»: видна при включённых абонементах или активном остатке
 * (решение владельца 2026-10-15); без абонемента — состояние «нет абонемента».
 */
export function sessionsTile(
  subscriptionsEnabled: boolean,
  subscription: { left: number; total: number } | null,
) {
  if (subscription)
    return { kind: 'balance' as const, left: subscription.left, total: subscription.total }
  return subscriptionsEnabled ? { kind: 'none' as const } : null
}

/** Маркер на плитке «Мои записи»: сколько записей ждут оплаты (сигнал «оплатить» с главной). */
export const awaitingPaymentLabel = (count: number) =>
  count > 0 ? `${pendingLabel(count)} оплаты` : null
