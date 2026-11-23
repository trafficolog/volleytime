import {
  GROUP_PAGE_MODERATION_REASON_CODES,
  type GroupPageComplaintReason,
  type GroupPageModerationReason,
  type GroupPageModerationState,
  type GroupPagePublicState,
  type PlatformGroupPageCities,
  type PlatformGroupPageComplaint,
  type PlatformGroupPageComplaints,
  type PlatformGroupPageHistoryEntry,
  type PlatformGroupPageRow,
} from '@volley-time/shared'

import { pluralRu } from '~/utils/desktop-players'

/**
 * Модерация страниц групп в Root Admin (24.1.3, R-06): только оформление ответов
 * `/api/platform/group-pages*` и `/api/platform/group-page-complaints*`. Решения и счётчики
 * считает сервер, здесь ничего не пересчитывается.
 */

export const MODERATION_TIME_ZONE = 'Europe/Minsk'

export const MODERATION_STATE_CHIPS: Record<GroupPagePublicState, { label: string; chip: string }> =
  {
    index: { label: 'в поиске', chip: 'vt-chip--grass' },
    own: { label: 'noindex · владелец', chip: 'vt-chip--state' },
    noindex: { label: 'noindex · root', chip: 'vt-chip--amber' },
    hidden: { label: 'скрыта · 404', chip: 'vt-chip--rose' },
  }

export type PagesFilter = 'all' | 'moderated' | 'complaints'
export const PAGES_FILTERS: readonly { key: PagesFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'moderated', label: 'С решениями' },
  { key: 'complaints', label: 'С жалобами' },
]

export type CityScope = 'pages' | 'issues' | 'all'

/** Страна целиком вместо города. */
export const ALL_COUNTRY = '*'

type City = PlatformGroupPageCities['regions'][number]['cities'][number]

export function cityInScope(city: City, scope: CityScope): boolean {
  if (scope === 'all') return true
  return scope === 'pages' ? city.pages > 0 : city.issues > 0
}

/** Сравнение без регистра и «ё», как на сервере (`moderationCityKey`). */
export function searchKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replace(/ё/g, 'е')
}

export function citiesKpis(totals: PlatformGroupPageCities['totals']): [string, string, string][] {
  return [
    ['Городов в каталоге', String(totals.cities), `${totals.citiesWithPages} со страницами`],
    ['Страниц групп', String(totals.pages), `${totals.indexed} в поиске`],
    ['Noindex · root', String(totals.noindex), 'открыты по ссылке'],
    ['Скрыто · root', String(totals.hidden), 'отдают 404'],
  ]
}

/** «Что произойдёт»: что остаётся доступным после решения. */
export function moderationFacts(
  kind: GroupPageModerationState,
  city: string | null,
): { ok: boolean; text: string }[] {
  const place = city ? `«${city}»` : 'города'
  return [
    kind === 'hidden'
      ? { ok: false, text: 'Открывается по ссылке · 404' }
      : { ok: true, text: 'Открывается по ссылке' },
    { ok: false, text: 'В поиске и sitemap' },
    { ok: false, text: `В каталоге ${place}` },
    { ok: true, text: 'Запись в Telegram' },
  ]
}

/** Превью уведомления в бот: тот же текст, что рассылает шаблон `group_page_hidden`/`_noindex`. */
export function botPreview(
  kind: GroupPageModerationState,
  groupName: string,
  reasonTitle: string | null,
  note: string,
) {
  const hidden = kind === 'hidden'
  return {
    title: hidden ? '⛔ Страница группы скрыта' : '🔍 Страница закрыта от поиска',
    line: `«${groupName}» · ${hidden ? 'по ссылке теперь не открывается' : 'по ссылке открывается, в поиске её нет'}`,
    reason: `Причина: ${reasonTitle ?? '—'}`,
    note: note.trim(),
    button: 'Открыть кабинет',
  }
}

/** Причина по умолчанию в окне решения из жалобы; для «Другое» причину выбирает модератор. */
export function complaintPreset(
  reason: GroupPageComplaintReason,
): GroupPageModerationReason | null {
  const map: Partial<Record<GroupPageComplaintReason, GroupPageModerationReason>> = {
    price: 'price',
    media: 'media',
    inactive: 'inactive',
    fraud: 'pay',
  }
  return map[reason] ?? null
}

export function isModerationReason(code: string | null): code is GroupPageModerationReason {
  return !!code && (GROUP_PAGE_MODERATION_REASON_CODES as readonly string[]).includes(code)
}

const dateTime = new Intl.DateTimeFormat('ru-RU', {
  timeZone: MODERATION_TIME_ZONE,
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const dateOnly = new Intl.DateTimeFormat('ru-RU', {
  timeZone: MODERATION_TIME_ZONE,
  day: 'numeric',
  month: 'long',
})

/** «20 мая, 18:40» по Минску: не зависит от часового пояса устройства. */
export function formatWhen(iso: string): string {
  return dateTime.format(new Date(iso)).replace(' в ', ', ')
}

export function formatDay(iso: string): string {
  return dateOnly.format(new Date(iso))
}

/** Возраст жалобы: «5 мин», «6 ч», «3 д». */
export function ageText(iso: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `${Math.max(1, minutes)} мин`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} ч`
  return `${Math.floor(hours / 24)} д`
}

export function complaintsKpis(
  stats: PlatformGroupPageComplaints['stats'],
  now: number,
): [string, string, string][] {
  const oldest = stats.oldestOpenAt ? `старшая ${ageText(stats.oldestOpenAt, now)}` : 'новых нет'
  const avg =
    stats.avgHoursToClose30d === null
      ? 'нет решённых'
      : `среднее время ${Math.round(stats.avgHoursToClose30d)} ч`
  return [
    ['Новые', String(stats.open), oldest],
    ['Решено за 30 дней', String(stats.closed30d), avg],
    ['Отсечено лимитом', String(stats.limited30d), 'больше 3 в сутки с устройства'],
  ]
}

/** Источник жалобы для root: вошедший пользователь или посетитель без входа. */
export function reporterText(reporter: PlatformGroupPageComplaint['reporter']): {
  kind: 'вход' | 'посетитель'
  detail: string
} {
  if (reporter.kind === 'user') {
    return {
      kind: 'вход',
      detail: reporter.telegramUsername ? `@${reporter.telegramUsername}` : reporter.name,
    }
  }
  return { kind: 'посетитель', detail: 'без входа' }
}

/** Итог закрытой жалобы строкой для списка «Решённые». */
export function resolutionText(c: PlatformGroupPageComplaint): string {
  const when = c.resolvedAt ? ` · ${formatDay(c.resolvedAt)}` : ''
  if (c.resolution === 'no_violation') return `Отклонена · нарушений нет${when}`
  if (c.resolution === 'hidden') return `Страница скрыта${when}`
  if (c.resolution === 'noindex') return `Принудительный noindex${when}`
  return ''
}

export function sameReasonText(count: number): string {
  return `ещё ${count} с той же причиной`
}

export function pagesCountText(n: number): string {
  return `${n} ${pluralRu(n, 'страница', 'страницы', 'страниц')}`
}

export function historyEntryText(entry: PlatformGroupPageHistoryEntry): string {
  const reason = entry.reasonTitle ? ` · ${entry.reasonTitle}` : ''
  switch (entry.kind) {
    case 'hidden':
      return `Скрыта${reason}`
    case 'noindex':
      return `Принудительный noindex${reason}`
    case 'restored':
      return 'Решение снято, страница возвращена'
    default:
      return `Жалоба с публичной страницы${reason}`
  }
}

/** Действия строки каталога по состоянию страницы. */
export function rowActions(row: PlatformGroupPageRow): {
  restore: boolean
  restoreLabel: string
  noindex: boolean
  noindexDisabled: boolean
  hide: boolean
} {
  return {
    restore: row.state === 'hidden' || row.state === 'noindex',
    restoreLabel: row.state === 'noindex' ? 'Вернуть индексацию' : 'Вернуть',
    noindex: row.state === 'index' || row.state === 'own',
    noindexDisabled: row.state === 'own',
    hide: row.state !== 'hidden',
  }
}
