import type { EventListItem } from '../components/EventCard.vue'
import type { TabItem } from '../components/vt/TabBar.vue'

import { formatMoneyRu, ROLE_LABELS } from './labels'
import { pendingLabel, waitlistOrganizerLabel } from './status-model'

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

export function organizerTabItems(
  base: string,
  options: { collections?: boolean; collectionsDot?: boolean } = {},
): TabItem[] {
  return [
    { kind: 'link', to: base, label: 'События', icon: 'calendar' },
    { kind: 'link', to: `${base}/members`, label: 'Игроки', icon: 'users' },
    { kind: 'link', to: `${base}/cashbox`, label: 'Касса', icon: 'chart' },
    { kind: 'link', to: `${base}/payments`, label: 'Оплаты', icon: 'wallet' },
    // «Сборы» (21.1.5): между «Оплатами» и «Меню»; точка — пока вкладку не открывали
    ...(options.collections === false
      ? []
      : [
          {
            kind: 'link' as const,
            to: `${base}/collections`,
            label: 'Сборы',
            icon: 'gift',
            prefix: true,
            dot: options.collectionsDot === true,
          },
        ]),
    { kind: 'action', id: 'menu', label: 'Меню', icon: 'menu' },
  ]
}

export function pendingPaymentsForEvent<T extends { event?: { id: number } | null }>(
  payments: readonly T[],
  eventId: number,
): T[] {
  return payments.filter((payment) => payment.event?.id === eventId)
}

/** Сколько платежей ждёт подтверждения по каждому событию: одна запись списка = одна запись игрока. */
export function pendingCountsByEvent(
  payments: readonly { event?: { id: number } | null }[],
): Map<number, number> {
  const counts = new Map<number, number>()
  for (const payment of payments) {
    const id = payment.event?.id
    if (id !== undefined) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

export interface OrganizerEventChip {
  /** `amber` — нужно действие, `grass` — всё в порядке, `state` — нейтральная информация. */
  tone: 'amber' | 'grass' | 'state'
  text: string
}

interface ChipEvent {
  status: string
  taken: number
  waitlist: number
  waitlistSeats?: number
  price: number
  priceMode?: 'fixed' | 'split'
  pricing?: { mode: string }
}

/**
 * Чипы оплаты в строке события организатора (v3): amber = нужно действие, grass = в порядке,
 * серый = информация. `pending` — ожидающие платежи события (`null` — данные не пришли: чип оплаты
 * не рисуем, чтобы не врать «все оплатили»).
 */
export function organizerEventChips(
  event: ChipEvent,
  pending: number | null,
): OrganizerEventChip[] {
  const chips: OrganizerEventChip[] = []
  const split = event.pricing?.mode === 'split' || event.priceMode === 'split'
  const live = event.status !== 'cancelled' && event.status !== 'draft'
  if (live && pending !== null) {
    if (pending > 0) chips.push({ tone: 'amber', text: `${pendingLabel(pending)} оплаты` })
    else if (event.taken > 0 && (split || event.price > 0))
      chips.push({ tone: 'grass', text: 'все оплатили' })
  }
  if (live && event.waitlist > 0)
    chips.push({
      tone: 'state',
      text: `очередь · ${waitlistOrganizerLabel(event.waitlist, event.waitlistSeats)}`,
    })
  return chips
}

/** Цена места делёжа в списке: «≈ 30,00 BYN» до закрытия записи, точная после; не split — `null`. */
export function splitForecastLabel(event: {
  status: string
  currency: string
  pricing?: { mode: string; maxAmount: number; basis: string }
}): string | null {
  const pricing = event.pricing
  if (pricing?.mode !== 'split' || event.status === 'cancelled') return null
  return `${pricing.basis === 'settled' ? '' : '≈ '}${formatMoneyRu(pricing.maxAmount, event.currency)}`
}
