import { createHash, randomBytes } from 'node:crypto'

/**
 * Окно восстановления удалённой группы (21.2.17, D-15): по умолчанию 30 дней — умолчание
 * оркестратора, владелец может изменить переменной `GROUP_RESTORE_WINDOW_DAYS` (целое 1–365).
 * Некорректное значение не ломает удаление и не сокращает окно молча: берётся значение по умолчанию.
 */
export const DEFAULT_RESTORE_WINDOW_DAYS = 30

export function restoreWindowDays(value: string | undefined = process.env.GROUP_RESTORE_WINDOW_DAYS) {
  if (value === undefined || !/^\d{1,3}$/.test(value.trim())) return DEFAULT_RESTORE_WINDOW_DAYS
  const days = Number(value.trim())
  return days >= 1 && days <= 365 ? days : DEFAULT_RESTORE_WINDOW_DAYS
}

/**
 * Срок личной ссылки передачи владения: 72 часа — умолчание оркестратора (карточка задаёт только
 * «истекающий срок»). Получатель успевает открыть ссылку, owner может отменить передачу раньше.
 */
export const OWNERSHIP_TRANSFER_TTL_MS = 72 * 3600_000

/** Токен ссылки: 32 случайных байта, base64url (43 символа) — помещается в Telegram startapp. */
export const generateTransferToken = (): string => randomBytes(32).toString('base64url')

/** В базе хранится только SHA-256 токена (hex): чтение таблицы не даёт действующей ссылки. */
export const hashTransferToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex')

/** Форма токена до обращения к базе: чужой мусор не доходит до запроса. */
export const isTransferTokenShape = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
