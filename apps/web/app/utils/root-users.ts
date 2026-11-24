import {
  PLATFORM_USER_STATUS_FILTERS,
  type PlatformUserDetail,
  type PlatformUserMembership,
  type PlatformUserRow,
  type PlatformUsersCounts,
  type PlatformUserStatusFilter,
} from '@volley-time/shared'

import { pluralRu } from '~/utils/desktop-players'
import { activityTone, relativeShort } from '~/utils/root-organizations'

/**
 * Пользователи платформы (22.1.4): фильтры живут в URL (`?status=blocked&q=…&page=2`), поэтому
 * страницу можно обновить или отправить ссылкой. Значения по умолчанию в URL не пишутся.
 */
export interface UserFilters {
  status: PlatformUserStatusFilter
  q: string
  page: number
}

export const USER_PAGE_SIZE = 50
const MAX_SEARCH = 100

export const DEFAULT_USER_FILTERS: UserFilters = { status: 'all', q: '', page: 1 }

type QueryValue = string | null | (string | null)[] | undefined
type RouteQuery = Record<string, QueryValue>

const first = (value: QueryValue): string | undefined => {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' ? v : undefined
}

/** Фильтры из query маршрута: неизвестные и испорченные значения заменяются значениями по умолчанию. */
export function userFiltersFromQuery(query: RouteQuery): UserFilters {
  const status = first(query.status)
  const page = Number(first(query.page))
  return {
    status: PLATFORM_USER_STATUS_FILTERS.find((s) => s === status) ?? DEFAULT_USER_FILTERS.status,
    q: (first(query.q) ?? '').trim().slice(0, MAX_SEARCH),
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  }
}

/** Query для URL страницы: только то, что отличается от значений по умолчанию. */
export function userFiltersToQuery(filters: UserFilters): Record<string, string> {
  const q = filters.q.trim()
  return {
    ...(filters.status !== 'all' ? { status: filters.status } : {}),
    ...(q ? { q } : {}),
    ...(filters.page > 1 ? { page: String(filters.page) } : {}),
  }
}

/** Query запроса `/api/platform/users`: то же, плюс размер страницы. */
export function userApiQuery(filters: UserFilters): Record<string, string | number> {
  return { ...userFiltersToQuery(filters), pageSize: USER_PAGE_SIZE }
}

export function userSubtitle(counts: PlatformUsersCounts): string {
  const records = pluralRu(counts.all, 'учётная запись', 'учётные записи', 'учётных записей')
  const active = pluralRu(counts.active, 'активный', 'активных', 'активных')
  return `${counts.all} ${records} · ${counts.active} ${active} за неделю`
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export interface UserKpi {
  label: string
  value: string
  note: string
}

/** Четыре плитки сверху, как в макете: всего, Telegram, email, активные за 7 суток. */
export function userKpis(counts: PlatformUsersCounts): UserKpi[] {
  return [
    { label: 'Всего', value: String(counts.all), note: `+${counts.newThisWeek} за неделю` },
    {
      label: 'Связаны Telegram',
      value: String(counts.telegram),
      note: `${percent(counts.telegram, counts.all)}%`,
    },
    {
      label: 'Связан email',
      value: String(counts.email),
      note: `${percent(counts.email, counts.all)}%`,
    },
    {
      label: 'Активны 7д',
      value: String(counts.active),
      note: `WAU ${percent(counts.active, counts.all)}%`,
    },
  ]
}

export interface UserChip {
  value: PlatformUserStatusFilter
  label: string
  count: number
}

export function userChips(counts: PlatformUsersCounts): UserChip[] {
  return [
    { value: 'all', label: 'Все', count: counts.all },
    { value: 'active', label: 'Активные', count: counts.active },
    { value: 'blocked', label: 'Заблокированные', count: counts.blocked },
  ]
}

export function userCounter(shown: number, total: number): string {
  if (total === 0) return 'Пользователей нет'
  return `Показано ${shown} из ${total.toLocaleString('ru-RU').replace(/\s/g, ' ')}`
}

const ROLE_LABELS: Record<PlatformUserMembership['role'] | 'pending', string> = {
  owner: 'админ группы',
  organizer: 'организатор',
  coach: 'тренер',
  player: 'игрок',
  pending: 'заявка',
}

const MEMBER_STATUS_LABELS: Record<PlatformUserMembership['status'], string> = {
  pending: 'заявка',
  active: 'активен',
  guest: 'гость',
  blocked: 'заблокирован',
  left: 'вышел',
  rejected: 'отклонён',
}

const NO_NAME = 'Без имени'
const DASH = '—'

/** Первые буквы первых двух слов имени, как в макете: «Иван Петренко» → «ИП». */
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

const telegramLabel = (u: Pick<PlatformUserRow, 'telegramUsername' | 'telegramLinked'>) =>
  u.telegramUsername ? `@${u.telegramUsername}` : u.telegramLinked ? 'привязан' : DASH

export interface UserRowView {
  id: number
  name: string
  code: string
  initials: string
  telegram: string
  email: string
  groups: number
  role: string
  bookings: number
  activity: string
  tone: 'grass' | 'amber' | 'mute'
  blocked: boolean
  root: boolean
}

export function userRowView(row: PlatformUserRow, now: Date): UserRowView {
  const name = row.name.trim() || NO_NAME
  return {
    id: row.id,
    name,
    code: `usr_${row.id}`,
    initials: row.name.trim() ? initialsOf(row.name) : '?',
    telegram: telegramLabel(row),
    email: row.email ?? DASH,
    groups: row.groups,
    role: row.topRole ? ROLE_LABELS[row.topRole] : '',
    bookings: row.bookings,
    activity: relativeShort(row.lastActivityAt, now),
    tone: activityTone(row.lastActivityAt, now),
    blocked: row.blocked,
    root: row.isRootAdmin,
  }
}

const AUDIT_LABELS: Record<string, string> = {
  'user.blocked': 'Блокировка',
  'user.unblocked': 'Разблокировка',
}

export interface UserDetailView {
  title: string
  subtitle: string
  statusLabel: string | null
  canBlock: boolean
  canUnblock: boolean
  profile: { label: string; value: string }[]
  memberships: { key: string; name: string; code: string; role: string; status: string }[]
  audit: { id: number; time: string; action: string; actor: string }[]
}

/** Карточка пользователя: подписи и значения. `timeZone` — пояс просмотра (по умолчанию браузера). */
export function userDetailView(detail: PlatformUserDetail, timeZone?: string): UserDetailView {
  const date = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const time = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return {
    title: detail.name.trim() || NO_NAME,
    subtitle: `usr_${detail.id}`,
    statusLabel: detail.blocked ? 'заблокирован' : null,
    // себя и другого root заблокировать нельзя (сервер проверяет то же самое)
    canBlock: !detail.blocked && !detail.isRootAdmin,
    canUnblock: detail.blocked,
    profile: [
      { label: 'ID', value: `usr_${detail.id}` },
      { label: 'Telegram', value: telegramLabel(detail) },
      { label: 'Email', value: detail.email ?? DASH },
      {
        label: 'Роль на платформе',
        value: detail.isRootAdmin ? 'администратор платформы' : 'пользователь',
      },
      { label: 'Зарегистрирован', value: date.format(new Date(detail.createdAt)) },
    ],
    memberships: detail.memberships.map((m) => ({
      key: String(m.organizationId),
      name: m.organizationName,
      code: `org_${m.organizationSlug}`,
      role: ROLE_LABELS[m.role],
      status: MEMBER_STATUS_LABELS[m.status],
    })),
    audit: detail.recentAudit.map((a) => ({
      id: a.id,
      time: time.format(new Date(a.createdAt)).replace(',', ''),
      action: AUDIT_LABELS[a.action] ?? a.action,
      actor: a.actor ? a.actor.name || `#${a.actor.id}` : 'система',
    })),
  }
}

const BLOCK_ERRORS: Record<string, string> = {
  'platform.user_cannot_block_self': 'Нельзя заблокировать себя',
  'platform.user_cannot_block_root': 'Нельзя заблокировать администратора платформы',
  'platform.user_already_blocked': 'Пользователь уже заблокирован',
  'platform.user_not_blocked': 'Пользователь не заблокирован',
  'platform.user_not_found': 'Пользователь не найден',
}

export function blockErrorMessage(code: string | undefined): string {
  return (code && BLOCK_ERRORS[code]) || 'Не удалось выполнить действие'
}
