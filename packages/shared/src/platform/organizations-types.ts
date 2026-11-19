/**
 * Организации платформы для Root Admin (Task 22.1.3, `/api/platform/organizations`).
 * Окна «за месяц» и «за неделю» — скользящие: 30 и 7 суток до момента запроса.
 */
export const PLATFORM_ORG_STATUS_FILTERS = ['all', 'active', 'risk', 'blocked'] as const
export type PlatformOrgStatusFilter = (typeof PLATFORM_ORG_STATUS_FILTERS)[number]

export const PLATFORM_ORG_SORTS = ['activity', 'events'] as const
export type PlatformOrgSort = (typeof PLATFORM_ORG_SORTS)[number]

export interface PlatformOrgOwner {
  id: number
  name: string
  email: string | null
  telegramUsername: string | null
}

export interface PlatformOrganizationRow {
  id: number
  slug: string
  name: string
  city: string | null
  /** `active` или `suspended`: архивные группы в списке не показываются. */
  status: 'active' | 'suspended'
  owner: PlatformOrgOwner | null
  /** Баланс событий (20.2.1). */
  balance: number
  /** Баланс не больше порога «баланс заканчивается» (`EVENT_BALANCE_LOW_THRESHOLD`). */
  lowBalance: boolean
  /** Активные участники группы (включая организаторов). */
  members: number
  /** Состоявшиеся события за последние 30 суток. */
  eventsMonth: number
  /** Последнее событие или запись; без них — создание группы. */
  lastActivityAt: string
  createdAt: string
}

export interface PlatformOrganizationsCounts {
  all: number
  /** Группа не заблокирована и активна за последние 7 суток. */
  active: number
  /** Не заблокирована и (баланс заканчивается или нет активности 7 суток). */
  risk: number
  blocked: number
}

export interface PlatformOrganizationsPage {
  items: PlatformOrganizationRow[]
  /** Счётчики фишек: по всем группам, не зависят от фильтров и поиска. */
  counts: PlatformOrganizationsCounts
  /** Сколько групп подходит под фильтры. */
  total: number
  page: number
  pageSize: number
}

export interface PlatformOrganizationModules {
  subscriptions: boolean
  publicPage: boolean
  seoIndex: boolean
}

export interface PlatformOrganizationDetail {
  id: number
  slug: string
  name: string
  description: string | null
  city: string | null
  timezone: string
  currency: string
  status: 'active' | 'suspended' | 'archived'
  /** Мягкое удаление (D-15): момент удаления; `null` — не удалена. */
  deletedAt: string | null
  createdAt: string
  owner: PlatformOrgOwner | null
  modules: PlatformOrganizationModules
  stats: {
    balance: number
    lowBalance: boolean
    members: number
    eventsMonth: number
    lastActivityAt: string
  }
  /** Записи журнала группы за 7 суток, новые сверху; секреты скрыты как в журнале платформы. */
  recentAudit: {
    id: number
    createdAt: string
    action: string
    actor: { id: number; name: string } | null
    newValue: unknown
  }[]
  /** Последние операции баланса событий, новые сверху. */
  balanceHistory: {
    id: number
    createdAt: string
    delta: number
    balanceAfter: number
    reason: string
  }[]
}

export interface PlatformOrganizationCreateResult {
  id: number
  slug: string
  name: string
}
