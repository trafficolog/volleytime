import {
  PLATFORM_POLICIES,
  PLATFORM_ROLES,
  type PlatformPolicy,
  type PlatformRole,
} from '@volley-time/shared'

import { apiErrorCode, apiErrorMessage, apiErrorStatus } from '~/utils/api-error'

/**
 * Экран «Настройки → Команда & роли» (29.3.1, R-15): подписи ролей, роли для выбора, сообщения
 * об ошибках API и матрица прав. Матрица выводится из `PLATFORM_POLICIES`, а не дублирует её.
 */

export interface RoleInfo {
  label: string
  ru: string
  description: string
}

const ROLE_INFO: Record<PlatformRole, RoleInfo> = {
  owner: {
    label: 'Owner',
    ru: 'Владелец платформы',
    description: 'Всё, включая команду, тарифы, безопасность и API',
  },
  admin: {
    label: 'Admin',
    ru: 'Администратор',
    description: 'Вся операционная работа, без команды, тарифов, безопасности и API',
  },
  finance: {
    label: 'Finance',
    ru: 'Финансы',
    description: 'Баланс событий, заявки и выдача, подписки и выплаты',
  },
  moderator: {
    label: 'Moderator',
    ru: 'Модератор',
    description: 'Страницы групп, жалобы игроков и на страницы',
  },
  support: {
    label: 'Support',
    ru: 'Поддержка',
    description: 'Обращения, шаблоны и база знаний; жалобы — разбор и передача модератору',
  },
  analyst: {
    label: 'Analyst',
    ru: 'Аналитик',
    description: 'Только просмотр метрик и денег, без персональных данных',
  },
}

export const roleInfo = (role: PlatformRole): RoleInfo => ROLE_INFO[role]

/**
 * Роли в списке выбора. По референсу Owner предлагают только действующему Owner (его роль можно
 * сменить на любую); приглашение (`null`) и смена роли другого человека Owner не предлагают.
 */
export function assignableRoles(current: PlatformRole | null): PlatformRole[] {
  return PLATFORM_ROLES.filter((role) => role !== 'owner' || current === 'owner')
}

const STAFF_ERRORS: Record<string, string> = {
  'platform.staff_last_owner': 'Последнего Owner нельзя понизить или удалить',
  'platform.staff_exists': 'Этот человек уже в команде платформы',
  'platform.staff_same_role': 'У человека уже эта роль',
  'platform.staff_user_ambiguous': 'Найдено несколько пользователей: укажите email',
  'platform.staff_user_inactive': 'Пользователь заблокирован: пригласить его нельзя',
  'platform.staff_user_not_found': 'Пользователь с таким email или Telegram не найден',
  'platform.staff_not_found': 'Этого человека уже нет в команде. Список обновлён',
  'forbidden.platform_role': 'Управлять командой может только Owner',
  validation_failed: 'Укажите email или Telegram-имя и роль',
}

/** Сообщение об ошибке действий над командой: код домена, иначе общий текст. */
export function staffErrorMessage(e: unknown, fallback: string): string {
  const known = STAFF_ERRORS[apiErrorCode(e) ?? '']
  if (known) return known
  if (apiErrorStatus(e) === 422) return STAFF_ERRORS.validation_failed ?? fallback
  return apiErrorMessage(e, fallback)
}

type RoleSet = PlatformPolicy | readonly PlatformRole[]

export interface PermissionRow {
  label: string
  /** Полный доступ (●): политика изменений или явный список ролей. */
  full: RoleSet
  /** Только просмотр: роль есть в политике раздела, но не в `full`. */
  view?: PlatformPolicy
  /** Частичное действие: подпись вместо ● (например, «отклонить»). */
  partial?: { policy: PlatformPolicy; label: string }
}

/** Строки матрицы прав R-15 в порядке карточки. */
export const PERMISSION_ROWS: readonly PermissionRow[] = [
  { label: 'Обзор платформы', full: 'organizationsManage', view: 'overview' },
  {
    label: 'Организации и функции организаций',
    full: 'organizationsManage',
    view: 'organizations',
  },
  { label: 'Вход в организацию', full: 'organizationEnter' },
  { label: 'Пользователи и склейка дублей', full: 'usersManage', view: 'users' },
  { label: 'Поддержка: обращения, шаблоны, база знаний', full: 'support' },
  {
    label: 'Жалобы игроков',
    full: 'playerComplaints',
    partial: { policy: 'playerComplaintsEscalate', label: 'передать модератору' },
  },
  { label: 'Страницы групп: скрыть, noindex, вернуть', full: 'groupPagesModerate' },
  {
    label: 'Жалобы на страницы',
    full: 'groupPageComplaintsResolve',
    partial: { policy: 'groupPageComplaintsReject', label: 'отклонить' },
  },
  { label: 'Баланс событий: заявки и выдача', full: 'balanceManage', view: 'balance' },
  { label: 'Тарифы и пакеты', full: 'plansManage', view: 'plans' },
  { label: 'Подписки и выплаты', full: 'subscriptionsManage', view: 'subscriptions' },
  {
    label: 'Аудит',
    full: ['owner', 'admin'],
    partial: { policy: 'audit', label: 'свои разделы' },
  },
  { label: 'Настройки: флаги, лимиты, уведомления', full: 'settings' },
  { label: 'Команда, безопасность, API', full: 'team' },
]

export type PermissionCell = 'full' | 'view' | 'none' | (string & {})

const rolesOf = (set: RoleSet): readonly PlatformRole[] =>
  typeof set === 'string' ? PLATFORM_POLICIES[set] : set

/** Что роль может в строке матрицы: `full`, `view`, `none` или подпись частичного действия. */
export function permissionCell(row: PermissionRow, role: PlatformRole): PermissionCell {
  if (rolesOf(row.full).includes(role)) return 'full'
  if (row.partial && rolesOf(row.partial.policy).includes(role)) return row.partial.label
  if (row.view && rolesOf(row.view).includes(role)) return 'view'
  return 'none'
}
