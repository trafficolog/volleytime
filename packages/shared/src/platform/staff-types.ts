/**
 * Команда платформы и её роли (29.3.1, R-15, D-28). Одна роль на человека; источник истины —
 * таблица `platform_staff`. Матрица — спецификация R-15, утверждена владельцем 2026-11-24.
 */
export const PLATFORM_ROLES = [
  'owner',
  'admin',
  'finance',
  'moderator',
  'support',
  'analyst',
] as const

export type PlatformRole = (typeof PLATFORM_ROLES)[number]

const ALL = PLATFORM_ROLES

/**
 * Политики доступа к разделам Root Admin по матрице R-15: имя → роли, которым действие доступно.
 * «просмотр» в матрице — роль есть в политике раздела, но нет в политике изменений (`…Manage`).
 * Каждый маршрут `/api/platform/**` ссылается на одну политику (тест покрытия маршрутов).
 */
export const PLATFORM_POLICIES = {
  /** Своя роль и меню по ней: любой член команды. */
  self: ALL,
  /** Обзор платформы и аналитика функций. */
  overview: ALL,
  /** Организации и функции организаций: просмотр. */
  organizations: ALL,
  /** Организации: создание и изменения. */
  organizationsManage: ['owner', 'admin'],
  /** Вход в организацию (R-09). */
  organizationEnter: ['owner', 'admin'],
  /** Пользователи и склейка дублей: просмотр. */
  users: ['owner', 'admin', 'moderator', 'support'],
  /** Пользователи: блокировка, склейка. */
  usersManage: ['owner', 'admin'],
  /** Поддержка: обращения, шаблоны, база знаний (R-12–R-14, H-01). */
  support: ['owner', 'admin', 'support'],
  /** Жалобы игроков (R-10): решение. */
  playerComplaints: ['owner', 'admin', 'moderator'],
  /** Жалобы игроков: передать модератору. */
  playerComplaintsEscalate: ['owner', 'admin', 'moderator', 'support'],
  /** Страницы групп: список и история. */
  groupPages: ['owner', 'admin', 'moderator', 'support'],
  /** Страницы групп: скрыть, noindex, вернуть (R-06). */
  groupPagesModerate: ['owner', 'admin', 'moderator'],
  /** Жалобы на страницы: очередь. */
  groupPageComplaints: ['owner', 'admin', 'moderator', 'support'],
  /** Жалобы на страницы: принять меры. */
  groupPageComplaintsResolve: ['owner', 'admin', 'moderator'],
  /** Жалобы на страницы: отклонить. */
  groupPageComplaintsReject: ['owner', 'admin', 'moderator', 'support'],
  /** Баланс событий: заявки и выдача, просмотр (R-03). */
  balance: ['owner', 'admin', 'finance', 'analyst'],
  /** Баланс событий: решения по заявкам, начисления, безлимит. */
  balanceManage: ['owner', 'admin', 'finance'],
  /** Тарифы и пакеты: просмотр (R-02). */
  plans: ['owner', 'admin', 'finance', 'analyst'],
  /** Тарифы и пакеты: изменения. */
  plansManage: ['owner'],
  /** Подписки и выплаты: просмотр (R-04). */
  subscriptions: ['owner', 'admin', 'finance', 'analyst'],
  /** Подписки и выплаты: изменения. */
  subscriptionsManage: ['owner', 'finance'],
  /** Аудит (R-07); Finance, Moderator и Support видят только свои разделы. */
  audit: ['owner', 'admin', 'finance', 'moderator', 'support'],
  /** Настройки: флаги, лимиты, уведомления (R-05). */
  settings: ['owner', 'admin'],
  /** Команда, безопасность, API. */
  team: ['owner'],
} as const satisfies Record<string, readonly PlatformRole[]>

export type PlatformPolicy = keyof typeof PLATFORM_POLICIES

/** Роль проходит политику. */
export function platformRoleAllows(role: PlatformRole | null | undefined, policy: PlatformPolicy) {
  return role != null && (PLATFORM_POLICIES[policy] as readonly PlatformRole[]).includes(role)
}

/** Член команды платформы в разделе «Команда & роли». */
export interface PlatformStaffMember {
  userId: number
  name: string
  email: string | null
  telegramUsername: string | null
  role: PlatformRole
  invitedBy: { id: number; name: string } | null
  createdAt: string
}

export interface PlatformStaffList {
  members: PlatformStaffMember[]
}

/** Роль вошедшего члена команды (`GET /api/platform/staff/me`) — для меню по роли. */
export interface PlatformStaffMe {
  userId: number
  role: PlatformRole
  /** Политики, которые роль проходит. */
  policies: PlatformPolicy[]
}
