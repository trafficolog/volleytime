import type { MemberRow } from '~/composables/useOrganizations'
import { LEVEL_FILTER_ALL, filterByLevel } from '~/utils/player-level'

export type PlayersTab = 'all' | 'active' | 'pending' | 'guest' | 'blocked' | 'excluded'

/** Все статусы одним запросом; «вышел» и «отклонён» в списке игроков не показываются. */
export const PLAYER_FETCH_STATUSES = [
  'active',
  'pending',
  'guest',
  'blocked',
  'left',
  'rejected',
] as const

type ShownStatus = 'active' | 'pending' | 'guest' | 'blocked'

const TAB_STATUSES: Record<PlayersTab, readonly ShownStatus[]> = {
  all: ['active', 'pending', 'guest', 'blocked'],
  active: ['active'],
  pending: ['pending'],
  guest: ['guest'],
  blocked: ['blocked'],
  // исключённые (21.2.24) приходят отдельным запросом: статус `left` включает и вышедших добровольно
  excluded: [],
}

export const PLAYER_TABS: { id: PlayersTab; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'Активные' },
  { id: 'pending', label: 'Заявки' },
  { id: 'guest', label: 'Гости' },
  { id: 'blocked', label: 'Заблокированы' },
  { id: 'excluded', label: 'Исключённые' },
]

type WithStatus = Pick<MemberRow, 'status'>

function inTab(status: string, tab: PlayersTab): boolean {
  return (TAB_STATUSES[tab] as readonly string[]).includes(status)
}

/** Счётчики вкладок по одному полному списку участников. */
export function countPlayerTabs(members: readonly WithStatus[]): Record<PlayersTab, number> {
  const count = (tab: PlayersTab) => members.filter((m) => inTab(m.status, tab)).length
  return {
    all: count('all'),
    active: count('active'),
    pending: count('pending'),
    guest: count('guest'),
    blocked: count('blocked'),
    excluded: 0,
  }
}

/** Русское склонение: one=1, few=2–4, many=0,5–20 (с учётом 11–14). */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

/** «14 активных · 2 на модерации · 1 заблокирован»; нулевые части, кроме активных, опускаются. */
export function playersSubtitle(counts: Record<PlayersTab, number>): string {
  const parts = [`${counts.active} ${pluralRu(counts.active, 'активный', 'активных', 'активных')}`]
  if (counts.pending > 0) parts.push(`${counts.pending} на модерации`)
  if (counts.blocked > 0)
    parts.push(
      `${counts.blocked} ${pluralRu(counts.blocked, 'заблокирован', 'заблокированы', 'заблокированы')}`,
    )
  return parts.join(' · ')
}

type Searchable = {
  user: { name: string | null; telegramUsername: string | null }
}

/** Поиск по имени или @username без учёта регистра. */
export function searchPlayers<T extends Searchable>(rows: readonly T[], query: string): T[] {
  const q = query.trim().replace(/^@/, '').toLowerCase()
  if (!q) return [...rows]
  return rows.filter(
    (m) =>
      (m.user.name ?? '').toLowerCase().includes(q) ||
      (m.user.telegramUsername ?? '').toLowerCase().includes(q),
  )
}

export interface PlayersFilter {
  tab: PlayersTab
  query: string
  level: string
}

/** Вкладка → поиск → фильтр по уровню. */
export function filterPlayers(members: readonly MemberRow[], filter: PlayersFilter): MemberRow[] {
  const found = searchPlayers(
    members.filter((m) => inTab(m.status, filter.tab)),
    filter.query,
  )
  return filter.level === LEVEL_FILTER_ALL ? found : filterByLevel(found, filter.level)
}

/** Уровень назначается ожидающим, активным и гостям (зеркало API). */
export function canAssignLevelTo(status: string): boolean {
  return status === 'pending' || status === 'active' || status === 'guest'
}

/** Ссылка t.me/<username> только для допустимого Telegram-username, иначе null. */
export function telegramChatUrl(username: string | null | undefined): string | null {
  if (!username || !/^[A-Za-z0-9_]{3,64}$/.test(username)) return null
  return `https://t.me/${username}`
}

type InviteLike = {
  roleToAssign: string
  isRevoked: boolean
  expiresAt: string | Date | null
  maxUses: number | null
  usesCount: number
  deeplinkUrl: string
  type?: string
  defaultMemberStatus?: string
}

export function isInviteUsable(invite: Omit<InviteLike, 'roleToAssign' | 'deeplinkUrl'>): boolean {
  return (
    !invite.isRevoked &&
    (!invite.expiresAt || new Date(invite.expiresAt).getTime() > Date.now()) &&
    (invite.maxUses === null || invite.usesCount < invite.maxUses)
  )
}

/**
 * Ссылка, которую можно переиспользовать: безлимитная общая ссылка в группу для роли «игрок»
 * с тем же статусом нового участника, что получит свежая ссылка (настройка группы), и без
 * ограничения по числу вступлений. Ограниченные и одноразовые ссылки не переиспользуются.
 */
export function pickPlayerInvite<T extends InviteLike>(
  invites: readonly T[],
  defaultMemberStatus: string,
): T | null {
  return (
    invites.find(
      (i) =>
        i.roleToAssign === 'player' &&
        i.maxUses === null &&
        (i.type === undefined || i.type === 'organization_join') &&
        i.defaultMemberStatus === defaultMemberStatus &&
        isInviteUsable(i),
    ) ?? null
  )
}
