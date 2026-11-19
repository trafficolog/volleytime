import { pluralEvents } from './cabinet-shell'
import { formatMoneyRu } from './labels'

/** Экран «Баланс и оплата» кабинета (21.2.8, W-12). Форма данных — GET /event-balance и /entries (20.2.1). */
export type BalancePackage = {
  /** Код из каталога БД (22.2.1): `^[a-z0-9_]{1,64}$`. */
  code: string
  units: number
  /** minor units */
  amount: number
  currency: string
  /** Бейдж каталога (22.2.1); у ответа без поля — только `popular`. */
  badge?: 'popular' | 'discount' | 'best_price' | null
  popular: boolean
}

/** Подписи бейджей каталога; «Скидка» — фиксированная (D-18), не процент. */
const CATALOG_BADGES = { popular: 'Популярный', discount: 'Скидка', best_price: 'Лучшая цена' }

export type BalanceSummary = {
  balance: number
  lowThreshold: number
  low: boolean
  packages: BalancePackage[]
  pendingRequests: {
    id: number
    units: number
    amount: number
    currency: string
    createdAt: string
  }[]
}

export type BalanceEntry = {
  id: number
  delta: number
  reason: 'demo_grant' | 'pilot_grant' | 'purchase' | 'grant' | 'spend' | 'refund' | 'correction'
  balanceAfter: number
  actorKind: 'user' | 'system'
  author: { id: number; name: string | null } | null
  source: string | null
  comment: string | null
  event: { id: number; title: string; startsAt: string } | null
  purchaseRequestId: number | null
  createdAt: string
}

export function packageViews(packages: BalancePackage[]) {
  return packages.map((p) => {
    const perUnit = p.amount / p.units
    // только бейдж каталога из Root Admin (D-19): процент скидки в кабинете не вычисляется
    let badge: string | null = null
    if (p.badge) badge = CATALOG_BADGES[p.badge]
    else if (p.popular) badge = 'Популярный'
    return {
      code: p.code,
      units: p.units,
      unitsCaption: pluralEvents(p.units),
      price: formatMoneyRu(p.amount, p.currency),
      perUnit: formatMoneyRu(Math.round(perUnit), p.currency),
      badge,
      popular: p.popular || p.badge === 'popular',
    }
  })
}

/** Подзаголовок страницы: единица — «событие» (D-10). */
export function balanceSubtitle(balance: number | null): string {
  if (balance === null) return 'Баланс событий'
  return `${balance} ${pluralEvents(balance)} на балансе`
}

export function lowBalanceWarning(
  summary: { balance: number; low: boolean } | null,
): string | null {
  if (!summary || !summary.low) return null
  if (summary.balance <= 0) {
    return 'Баланс исчерпан. Пополните баланс, чтобы публиковать новые события.'
  }
  return (
    `Баланс заканчивается: осталось ${summary.balance} ${pluralEvents(summary.balance)}. ` +
    'Пополните баланс, чтобы публиковать новые события.'
  )
}

export function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `−${Math.abs(delta)}`
  return '0'
}

/** Дата операции в часовом поясе группы: «25 мая», для прошлых лет — «25 мая 2025». */
export function entryDate(iso: string, timeZone: string, now = new Date()): string {
  const date = new Date(iso)
  const year = (d: Date) =>
    new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric' }).format(d)
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: 'numeric',
    month: 'long',
    ...(year(date) === year(now) ? {} : { year: 'numeric' }),
  })
    .format(date)
    .replace(/\s?г\.$/, '')
}

export function entryView(entry: BalanceEntry) {
  const eventTitle = entry.event ? `«${entry.event.title}»` : null
  let chip: string
  let title: string
  switch (entry.reason) {
    case 'spend':
      chip = 'списание'
      title = eventTitle ? `Событие ${eventTitle}` : 'Событие удалено'
      break
    case 'refund':
      chip = 'возврат'
      title = eventTitle ? `Возврат · отменено событие ${eventTitle}` : 'Возврат · событие отменено'
      break
    case 'purchase':
      chip = 'покупка'
      title = `Пакет ${entry.delta} ${pluralEvents(entry.delta)}`
      break
    case 'demo_grant':
      chip = 'начисление'
      title = 'Стартовые события от платформы'
      break
    case 'pilot_grant':
      chip = 'начисление'
      title = 'Стартовый баланс группы'
      break
    case 'grant':
      chip = 'начисление'
      title = 'Начисление от платформы'
      break
    case 'correction':
      chip = 'корректировка'
      title = 'Корректировка баланса'
      break
    default:
      chip = 'операция'
      title = 'Операция с балансом'
  }
  return {
    id: entry.id,
    chip,
    title,
    note: entry.comment,
    delta: formatDelta(entry.delta),
    positive: entry.delta > 0,
    balanceAfter: entry.balanceAfter,
    createdAt: entry.createdAt,
  }
}
