/**
 * Пользователи платформы для Root Admin (Task 22.1.4, `/api/platform/users`).
 * Окно «активны» — скользящие 7 суток до момента запроса. Персональные данные (email,
 * Telegram-имя) отдаёт только root; телефон и числовой Telegram id наружу не выходят.
 */
export const PLATFORM_USER_STATUS_FILTERS = ['all', 'active', 'blocked'] as const
export type PlatformUserStatusFilter = (typeof PLATFORM_USER_STATUS_FILTERS)[number]

/** Старшая роль среди активных членств; `pending` — есть только заявки; `null` — групп нет. */
export type PlatformUserTopRole = 'owner' | 'organizer' | 'coach' | 'player' | 'pending'

export interface PlatformUserRow {
  id: number
  name: string
  email: string | null
  telegramUsername: string | null
  /** Telegram привязан (`telegram_user_id` задан), даже если имя скрыто. */
  telegramLinked: boolean
  /** Активные членства в группах. */
  groups: number
  topRole: PlatformUserTopRole | null
  /** Записи на события, кроме отменённых. */
  bookings: number
  /** Последняя запись или обновление сессии; без них — регистрация. */
  lastActivityAt: string
  createdAt: string
  /** Платформенная блокировка (`users.is_active = false`). */
  blocked: boolean
  isRootAdmin: boolean
}

export interface PlatformUsersCounts {
  all: number
  telegram: number
  email: number
  /** Не заблокированы и активны за последние 7 суток. */
  active: number
  blocked: number
  /** Зарегистрированы за последние 7 суток. */
  newThisWeek: number
}

export interface PlatformUsersPage {
  items: PlatformUserRow[]
  /** Счётчики по всем пользователям: не зависят от фильтров и поиска. */
  counts: PlatformUsersCounts
  /** Сколько пользователей подходит под фильтр и поиск. */
  total: number
  page: number
  pageSize: number
}

export interface PlatformUserMembership {
  organizationId: number
  organizationName: string
  organizationSlug: string
  role: 'owner' | 'organizer' | 'coach' | 'player'
  status: 'pending' | 'active' | 'guest' | 'blocked' | 'left' | 'rejected'
}

export interface PlatformUserDetail extends PlatformUserRow {
  memberships: PlatformUserMembership[]
  /** Записи журнала платформы об этом пользователе (блокировка, разблокировка), новые сверху. */
  recentAudit: {
    id: number
    createdAt: string
    action: string
    actor: { id: number; name: string } | null
  }[]
}

export interface PlatformUserBlockResult {
  id: number
  blocked: boolean
}
