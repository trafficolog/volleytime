import type { TabItem } from '../components/vt/TabBar.vue'

interface Member {
  role: string
  status: string
}

interface MenuLink {
  to: string
  label: string
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
