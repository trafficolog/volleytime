import { formatDay, formatTime } from '@volley-time/shared'

import { plural } from './group-schedule'
import { formatPrice } from './labels'
import { levelTitle, type PlayerLevelView } from './player-level'

/** Открытые игры рядом (30.3.3, M-32): чистые функции над ответом `GET /api/me/nearby-games`. */

export interface NearbyGame {
  id: number
  title: string
  startsAt: string
  endsAt: string
  level: string | null
  place: { name: string | null; address: string | null }
  capacity: number
  price: { amount: number; currency: string } | null
  taken: number
  full: boolean
  publicSlug: string
  group: {
    id: number
    slug: string
    name: string
    city: string | null
    district: string | null
    logoUpdatedAt: string | null
    timezone: string
  }
}

export const NEARBY_LEVEL_ALL = 'all'
export const NEARBY_PAGE_SIZE = 20

/** Фильтр по умолчанию — «мой уровень», если организатор его назначил; иначе «Все». */
export function defaultNearbyLevel(myLevel: string | null | undefined): string {
  return myLevel ?? NEARBY_LEVEL_ALL
}

/**
 * Варианты фильтра: «Все» и «мой уровень В1…В4+» по шкале (подписи макета M-32). «Без уровня»
 * нет: у игры уровень не обязателен.
 */
export function nearbyLevelOptions(
  levels: readonly PlayerLevelView[],
): { value: string; label: string }[] {
  return [
    { value: NEARBY_LEVEL_ALL, label: 'Все' },
    ...[...levels]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((level) => ({ value: level.code, label: `мой уровень ${level.title}` })),
  ]
}

/** Параметры запроса: `level` не передаётся для «Все». */
export function nearbyQuery(
  city: string,
  level: string,
  offset = 0,
): Record<string, string | number> {
  return {
    city,
    ...(level !== NEARBY_LEVEL_ALL ? { level } : {}),
    limit: NEARBY_PAGE_SIZE,
    ...(offset > 0 ? { offset } : {}),
  }
}

/** «чт, 18 сент., 19:00–21:00» — в часовом поясе группы-организатора. */
export function nearbyWhen(game: NearbyGame): string {
  const tz = game.group.timezone
  return `${formatDay(game.startsAt, tz)}, ${formatTime(game.startsAt, tz)}–${formatTime(game.endsAt, tz)}`
}

/** «Школа №24» или пусто; адрес не нужен в ленте — он на странице группы. */
export function nearbyPlace(game: NearbyGame): string | null {
  return game.place.name?.trim() || null
}

/** «Мест нет» или «3 места» (как в макете: число свободных мест). */
export function nearbySeats(game: NearbyGame): string {
  const left = Math.max(0, game.capacity - game.taken)
  if (game.full || left === 0) return 'Мест нет'
  return `${left} ${plural(left, 'место', 'места', 'мест')}`
}

/** Подпись уровня игры: «любой уровень», если не ограничен. */
export function nearbyLevelLabel(game: NearbyGame, levels: readonly PlayerLevelView[]): string {
  return levelTitle(game.level, levels) ?? 'любой уровень'
}

/** Переход на страницу группы: запись идёт по её правилам (режим записи, оплата, очередь). */
export function nearbyGroupPath(game: NearbyGame): string {
  return `/g/${game.group.slug}`
}
/** «12,00 BYN», «Бесплатно»; у складчины цены в ленте нет. */
export function nearbyPrice(game: NearbyGame): string | null {
  if (!game.price) return null
  return formatPrice(game.price.amount, game.price.currency)
}
