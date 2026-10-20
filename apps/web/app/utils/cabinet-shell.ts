import { desktopNavItems } from './desktop-org-ui'

/** Разделы сайдбара кабинета v3 (20.5.3, W-01). Страницы «Сборы», «Отчёты», «Баланс» добавят их карточки. */
export type CabinetNavSection = {
  key: 'organization' | 'platform'
  heading: string
  items: ReturnType<typeof desktopNavItems>
}

export function cabinetNavSections(orgId: number, subscriptionsEnabled: boolean) {
  const items = desktopNavItems(orgId, subscriptionsEnabled)
  return [
    {
      key: 'organization',
      heading: 'Организация',
      items: items.filter((item) => item.key !== 'settings'),
    },
    {
      key: 'platform',
      heading: 'Платформа',
      items: items.filter((item) => item.key === 'settings'),
    },
  ] satisfies CabinetNavSection[]
}

const NAV_ICONS: Record<string, string> = {
  overview: 'home',
  events: 'calendar',
  members: 'users',
  plans: 'ticket',
  payments: 'card',
  cashbox: 'wallet',
  settings: 'settings',
}

export function cabinetNavIcon(key: string): string {
  return NAV_ICONS[key] ?? 'calendar'
}

function pluralEvents(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'событие'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'события'
  return 'событий'
}

/** Плашка «Баланс событий» в сайдбаре: единица — «событие» (D-10). */
export function eventBalanceCard(
  balance: { balance: number; low: boolean } | null,
  failed = false,
) {
  if (!balance) return { value: '—', caption: failed ? 'нет данных' : 'баланс событий', low: false }
  return {
    value: String(balance.balance),
    caption: `${pluralEvents(balance.balance)} в балансе`,
    low: balance.low,
  }
}
