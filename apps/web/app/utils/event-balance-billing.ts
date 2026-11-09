import { pluralEvents } from './cabinet-shell'
import { formatMoneyRu } from './labels'

/** Экран «Баланс и оплата» кабинета (21.2.8, W-12). Форма данных — GET /event-balance и /entries (20.2.1). */
export type BalancePackage = {
  code: 'events_10' | 'events_30' | 'events_100'
  units: number
  /** minor units */
  amount: number
  currency: string
  popular: boolean
}

export type BalanceSummary = {
  balance: number
  lowThreshold: number
  low: boolean
  packages: BalancePackage[]
  pendingRequests: { id: number; units: number; amount: number; currency: string; createdAt: string }[]
}

export type BalanceEntry = {
  id: number
  delta: number
  reason:
    | 'demo_grant'
    | 'pilot_grant'
    | 'purchase'
    | 'grant'
    | 'spend'
    | 'refund'
    | 'correction'
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
  const base = packages.reduce<BalancePackage | null>(
    (min, p) => (min === null || p.units < min.units ? p : min),
    null,
  )
  return packages.map((p) => {
    const perUnit = p.amount / p.units
    let badge: string | null = null
    if (p.popular) badge = 'Популярный'
    else if (base && p.code !== base.code) {
      const percent = Math.round((1 - perUnit / (base.amount / base.units)) * 100)
      if (percent > 0) badge = `−${percent}%`
    }
    return {
      code: p.code,
      units: p.units,
      unitsCaption: pluralEvents(p.units),
      price: formatMoneyRu(p.amount, p.currency),
      perUnit: formatMoneyRu(Math.round(perUnit), p.currency),
      badge,
      popular: p.popular,
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
