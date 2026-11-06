import {
  formatMoney,
  formatShortDate,
  type PlayerStats,
  type PlayersStatsPeriod,
} from '@volley-time/shared'

import { pluralRu } from '~/utils/desktop-players'

/** Колонка «Активность»: «24 тр.», «посл. 03.05.2026»; доля посещаемости — для карточки игрока. */
export function activityView(
  stats: PlayerStats,
  timezone: string,
): { visits: string; last: string; lastDate: string; rate: string } {
  const { visits, lastVisitAt, ratePercent } = stats.attendance
  const lastDate = lastVisitAt ? formatShortDate(lastVisitAt, timezone) : '—'
  return {
    visits: `${visits} тр.`,
    last: lastVisitAt ? `посл. ${lastDate}` : 'нет визитов',
    lastDate,
    rate: ratePercent === null ? '—' : `${ratePercent}%`,
  }
}

/** Колонка «Абонемент»: остаток / всего и срок; `null` — нет действующего абонемента. */
export function subscriptionView(
  stats: PlayerStats,
  timezone: string,
): { label: string; hint: string } | null {
  const sub = stats.subscription
  if (!sub) return null
  const term = sub.expiresAt ? `до ${formatShortDate(sub.expiresAt, timezone)}` : 'бессрочно'
  return {
    label: `${sub.remaining} / ${sub.total}`,
    hint: sub.count > 1 ? `${term} · абонементов: ${sub.count}` : term,
  }
}

/** Колонка «Задолженность»: сумма и число неоплаченных мест; `null` — долга нет. */
export function debtView(stats: PlayerStats): { label: string; hint: string } | null {
  const { amount, seats, currency } = stats.debt
  if (amount <= 0 && seats <= 0) return null
  return {
    label: formatMoney(amount, currency),
    hint: `${seats} ${pluralRu(seats, 'место', 'места', 'мест')}`,
  }
}

/** Подпись окна посещаемости: «за период 20.02.2026 — 20.05.2026» (даты уже локальные). */
export function playerStatsPeriodLabel(period: PlayersStatsPeriod): string {
  const fmt = (date: string) => date.split('-').reverse().join('.')
  return `за период ${fmt(period.from)} — ${fmt(period.to)}`
}
