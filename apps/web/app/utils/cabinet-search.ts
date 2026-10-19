import type { CabinetSearchResult } from '@volley-time/core'

import { paymentStatusLabel, paymentTargetLabel } from './desktop-payments'
import { EVENT_STATUS_LABELS, ROLE_LABELS, displayName, formatMoneyRu, label } from './labels'

/** Поиск начинается с двух символов (совпадает с сервером, 20.5.2). */
export const CABINET_SEARCH_MIN = 2
export const CABINET_SEARCH_DEBOUNCE_MS = 250

export type SearchGroupKey = 'players' | 'events' | 'payments'

export interface SearchRow {
  key: string
  to: string
  title: string
  subtitle: string
}

export interface SearchSection {
  key: SearchGroupKey
  heading: string
  rows: SearchRow[]
  more: boolean
}

/** Тип данных ответа API (даты приходят строками). */
type Json<T> = T extends Date ? string : T extends object ? { [K in keyof T]: Json<T[K]> } : T
export type CabinetSearchResponse = Json<CabinetSearchResult>

export function shouldSearch(raw: string): boolean {
  return raw.replace(/\s+/g, ' ').trim().length >= CABINET_SEARCH_MIN
}

function eventDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

/** Разделы результатов в порядке макета; пустые типы не показываются. */
export function buildSearchSections(
  orgId: number,
  data: CabinetSearchResponse,
  timeZone: string,
): SearchSection[] {
  const base = `/app/orgs/${orgId}`
  const sections: SearchSection[] = []
  if (data.players.items.length > 0) {
    sections.push({
      key: 'players',
      heading: 'Игроки',
      more: data.players.more,
      rows: data.players.items.map((p) => ({
        key: `p${p.memberId}`,
        // отдельной страницы игрока нет: ведём в список участников
        to: `${base}/members`,
        title: displayName(p),
        subtitle: [p.telegramUsername ? `@${p.telegramUsername}` : '', label(ROLE_LABELS, p.role)]
          .filter(Boolean)
          .join(' · '),
      })),
    })
  }
  if (data.events.items.length > 0) {
    sections.push({
      key: 'events',
      heading: 'События',
      more: data.events.more,
      rows: data.events.items.map((e) => ({
        key: `e${e.id}`,
        to: `${base}/events/${e.id}`,
        title: e.title,
        subtitle: [
          eventDate(e.startsAt, timeZone),
          e.venueName ?? '',
          label(EVENT_STATUS_LABELS, e.status),
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    })
  }
  if (data.payments && data.payments.items.length > 0) {
    sections.push({
      key: 'payments',
      heading: 'Платежи',
      more: data.payments.more,
      rows: data.payments.items.map((p) => ({
        key: `m${p.id}`,
        to: `${base}/payments`,
        title: `${displayName(p.user)} · ${formatMoneyRu(p.amount, p.currency)}`,
        subtitle: [
          paymentTargetLabel({ event: p.event, plan: p.planName ? { name: p.planName } : null }),
          paymentStatusLabel(p.status),
        ].join(' · '),
      })),
    })
  }
  return sections
}
