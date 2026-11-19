import {
  PLATFORM_ORG_SORTS,
  PLATFORM_ORG_STATUS_FILTERS,
  type PlatformOrganizationDetail,
  type PlatformOrganizationRow,
  type PlatformOrganizationsCounts,
  type PlatformOrgSort,
  type PlatformOrgStatusFilter,
  safeTimezone,
} from '@volley-time/shared'

/**
 * Организации платформы (22.1.3): фильтры живут в URL (`?status=risk&lowBalance=1&sort=events&q=…`),
 * поэтому страницу можно обновить или отправить ссылкой. Значения по умолчанию в URL не пишутся.
 */
export interface OrgFilters {
  status: PlatformOrgStatusFilter
  lowBalance: boolean
  inactive: boolean
  sort: PlatformOrgSort
  q: string
  page: number
}

export const ORG_PAGE_SIZE = 50
const MAX_SEARCH = 100

export const DEFAULT_ORG_FILTERS: OrgFilters = {
  status: 'all',
  lowBalance: false,
  inactive: false,
  sort: 'activity',
  q: '',
  page: 1,
}

type QueryValue = string | null | (string | null)[] | undefined
type RouteQuery = Record<string, QueryValue>

const first = (value: QueryValue): string | undefined => {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' ? v : undefined
}

/** Фильтры из query маршрута: неизвестные и испорченные значения заменяются значениями по умолчанию. */
export function orgFiltersFromQuery(query: RouteQuery): OrgFilters {
  const status = first(query.status)
  const sort = first(query.sort)
  const page = Number(first(query.page))
  return {
    status: PLATFORM_ORG_STATUS_FILTERS.find((s) => s === status) ?? DEFAULT_ORG_FILTERS.status,
    lowBalance: first(query.lowBalance) === '1',
    inactive: first(query.inactive) === '1',
    sort: PLATFORM_ORG_SORTS.find((s) => s === sort) ?? DEFAULT_ORG_FILTERS.sort,
    q: (first(query.q) ?? '').trim().slice(0, MAX_SEARCH),
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  }
}

/** Query для URL страницы: только то, что отличается от значений по умолчанию. */
export function orgFiltersToQuery(filters: OrgFilters): Record<string, string> {
  const q = filters.q.trim()
  return {
    ...(filters.status !== 'all' ? { status: filters.status } : {}),
    ...(filters.lowBalance ? { lowBalance: '1' } : {}),
    ...(filters.inactive ? { inactive: '1' } : {}),
    ...(filters.sort !== 'activity' ? { sort: filters.sort } : {}),
    ...(q ? { q } : {}),
    ...(filters.page > 1 ? { page: String(filters.page) } : {}),
  }
}

/** Query запроса `/api/platform/organizations`: то же, плюс размер страницы. */
export function orgApiQuery(filters: OrgFilters): Record<string, string | number> {
  return { ...orgFiltersToQuery(filters), pageSize: ORG_PAGE_SIZE }
}

/** Сколько фильтров из выпадающей панели включено (значок на кнопке «Фильтры»). */
export function orgPanelFilterCount(filters: OrgFilters): number {
  return Number(filters.lowBalance) + Number(filters.inactive) + Number(filters.sort !== 'activity')
}

export interface OrgChip {
  value: PlatformOrgStatusFilter
  label: string
  count: number
  tint: 'amber' | null
}

export function orgChips(counts: PlatformOrganizationsCounts): OrgChip[] {
  return [
    { value: 'all', label: 'Все', count: counts.all, tint: null },
    { value: 'active', label: 'Активные', count: counts.active, tint: null },
    { value: 'risk', label: 'В риске', count: counts.risk, tint: 'amber' },
    { value: 'blocked', label: 'Заблокированы', count: counts.blocked, tint: null },
  ]
}

export function orgSubtitle(counts: PlatformOrganizationsCounts): string {
  return `${counts.all} всего · ${counts.active} активных за неделю · ${counts.risk} в риске`
}

export function orgCounter(shown: number, total: number): string {
  if (total === 0) return 'Организаций нет'
  return `Показано ${shown} из ${total.toLocaleString('ru-RU').replace(/\s/g, ' ')}`
}

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** Давность коротко, как в макете: «5 мин», «1 ч», «2 д». */
export function relativeShort(iso: string, now: Date): string {
  const age = Math.max(0, now.getTime() - new Date(iso).getTime())
  if (age < MINUTE_MS) return 'сейчас'
  if (age < HOUR_MS) return `${Math.floor(age / MINUTE_MS)} мин`
  if (age < DAY_MS) return `${Math.floor(age / HOUR_MS)} ч`
  return `${Math.floor(age / DAY_MS)} д`
}

/** Цвет точки активности: сутки — зелёный, неделя — жёлтый, дольше — серый. */
export function activityTone(iso: string, now: Date): 'grass' | 'amber' | 'mute' {
  const age = now.getTime() - new Date(iso).getTime()
  if (age < DAY_MS) return 'grass'
  if (age < 7 * DAY_MS) return 'amber'
  return 'mute'
}

export function ownerLabel(owner: PlatformOrganizationRow['owner']): string {
  if (!owner) return '—'
  return (
    owner.name ||
    owner.email ||
    (owner.telegramUsername ? `@${owner.telegramUsername}` : `#${owner.id}`)
  )
}

export function ownerContact(owner: PlatformOrganizationRow['owner']): string {
  if (!owner) return ''
  return [owner.telegramUsername ? `@${owner.telegramUsername}` : null, owner.email]
    .filter(Boolean)
    .join(' · ')
}

export interface OrgRowView {
  id: number
  name: string
  code: string
  initials: string
  owner: string
  balance: number
  lowBalance: boolean
  members: number
  eventsMonth: number
  /** Заполнение полосы «событий в месяц»: 5% на событие, как в макете. */
  eventsPercent: number
  activity: string
  tone: 'grass' | 'amber' | 'mute'
  blocked: boolean
}

export function orgRowView(row: PlatformOrganizationRow, now: Date): OrgRowView {
  return {
    id: row.id,
    name: row.name,
    code: `org_${row.slug}`,
    initials: Array.from(row.name.trim()).slice(0, 2).join('').toUpperCase(),
    owner: ownerLabel(row.owner),
    balance: row.balance,
    lowBalance: row.lowBalance,
    members: row.members,
    eventsMonth: row.eventsMonth,
    eventsPercent: Math.min(100, row.eventsMonth * 5),
    activity: relativeShort(row.lastActivityAt, now),
    tone: activityTone(row.lastActivityAt, now),
    blocked: row.status === 'suspended',
  }
}

export interface OrgCreateForm {
  name: string
  slug: string
  city: string
  owner: string
}

/** Тело POST: пустые необязательные поля не отправляются. */
export function orgCreateBody(form: OrgCreateForm) {
  const slug = form.slug.trim()
  const city = form.city.trim()
  return {
    name: form.name.trim(),
    owner: form.owner.trim(),
    ...(slug ? { slug } : {}),
    ...(city ? { city } : {}),
  }
}

const SLUG_FORMAT = /^[a-z0-9-]{2,64}$/

/** Проверка формы до запроса; пустой результат — можно отправлять. */
export function orgCreateErrors(form: OrgCreateForm): Partial<Record<keyof OrgCreateForm, string>> {
  const errors: Partial<Record<keyof OrgCreateForm, string>> = {}
  const name = form.name.trim()
  if (name.length < 2 || name.length > 100) errors.name = 'Название: от 2 до 100 символов'
  const slug = form.slug.trim()
  if (slug && !SLUG_FORMAT.test(slug)) {
    errors.slug = 'Код: 2–64 символа, строчные латинские буквы, цифры и дефис'
  }
  if (form.city.trim().length > 100) errors.city = 'Город: не больше 100 символов'
  if (form.owner.trim().length < 3) errors.owner = 'Укажите email или @имя в Telegram владельца'
  return errors
}

const CREATE_ERRORS: Record<string, string> = {
  'organization.slug_taken': 'Такой код уже занят',
  'platform.owner_not_found': 'Пользователь с таким email или Telegram-именем не найден',
  'platform.owner_ambiguous': 'Под это имя подходит несколько пользователей: укажите email',
  'platform.owner_inactive': 'Этот пользователь отключён и не может владеть группой',
  validation_failed: 'Проверьте поля формы',
}

export function orgCreateErrorMessage(code: string | undefined): string {
  return (code && CREATE_ERRORS[code]) || 'Не удалось создать организацию'
}

const BALANCE_REASONS: Record<string, string> = {
  demo_grant: 'Демо-квота',
  pilot_grant: 'Пилотный баланс',
  purchase: 'Покупка пакета',
  grant: 'Начисление',
  spend: 'Списание за событие',
  refund: 'Возврат за событие',
  correction: 'Корректировка',
}

const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`)

const dateFormatter = (timeZone: string | undefined, withTime: boolean) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: 'numeric',
    month: withTime ? '2-digit' : 'long',
    ...(withTime
      ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const }
      : { year: 'numeric' }),
  })

export interface OrgDetailView {
  title: string
  subtitle: string
  statusLabel: string | null
  profile: { label: string; value: string }[]
  modules: { label: string; on: boolean }[]
  kpis: { label: string; value: string; note: string; tone: 'flame' | null }[]
  audit: { id: number; time: string; action: string; actor: string }[]
  history: { id: number; time: string; reason: string; delta: string; after: number }[]
}

/** Карточка организации: подписи и значения. Часовой пояс — группы, чтобы вывод не зависел от машины. */
export function orgDetailView(detail: PlatformOrganizationDetail, now: Date): OrgDetailView {
  const tz = safeTimezone(detail.timezone)
  const created = dateFormatter(tz, false).format(new Date(detail.createdAt))
  const statusLabel =
    detail.deletedAt !== null
      ? 'удалена'
      : detail.status === 'suspended'
        ? 'заблокирована'
        : detail.status === 'archived'
          ? 'в архиве'
          : null
  const time = (iso: string) => dateFormatter(tz, true).format(new Date(iso)).replace(',', '')
  const owner = detail.owner
  return {
    title: detail.name,
    subtitle: `org_${detail.slug} · создана ${created}`,
    statusLabel,
    profile: [
      { label: 'ID', value: `org_${detail.slug} · ${detail.id}` },
      {
        label: 'Владелец',
        value: owner
          ? [ownerLabel(owner), ownerContact(owner), `usr_${owner.id}`].filter(Boolean).join(' · ')
          : '—',
      },
      { label: 'Создана', value: created },
      { label: 'Город / TZ', value: `${detail.city ?? '—'} · ${detail.timezone}` },
      { label: 'Валюта', value: detail.currency },
      ...(detail.description ? [{ label: 'Описание', value: detail.description }] : []),
    ],
    modules: [
      { label: 'subscriptions', on: detail.modules.subscriptions },
      { label: 'public_page', on: detail.modules.publicPage },
      { label: 'seo_index', on: detail.modules.seoIndex },
    ],
    kpis: [
      {
        label: 'Баланс событий',
        value: String(detail.stats.balance),
        note: detail.stats.lowBalance ? 'баланс заканчивается' : 'достаточно',
        tone: detail.stats.lowBalance ? 'flame' : null,
      },
      {
        label: 'Игроков',
        value: String(detail.stats.members),
        note: 'активных участников',
        tone: null,
      },
      {
        label: 'Событий за 30 дней',
        value: String(detail.stats.eventsMonth),
        note: 'состоявшихся',
        tone: null,
      },
      {
        label: 'Активность',
        value: relativeShort(detail.stats.lastActivityAt, now),
        note: 'последнее событие или запись',
        tone: null,
      },
    ],
    audit: detail.recentAudit.map((a) => ({
      id: a.id,
      time: time(a.createdAt),
      action: a.action,
      actor: a.actor ? a.actor.name || `#${a.actor.id}` : 'system',
    })),
    history: detail.balanceHistory.map((h) => ({
      id: h.id,
      time: time(h.createdAt),
      reason: BALANCE_REASONS[h.reason] ?? h.reason,
      delta: signed(h.delta),
      after: h.balanceAfter,
    })),
  }
}
