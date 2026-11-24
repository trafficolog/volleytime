import { assertPlatformRole } from '@volley-time/core'
import { PLATFORM_ROLES, type PlatformRole } from '@volley-time/shared'
import type { H3Event } from 'h3'

import type { AuthedUser } from './auth'

export interface PlatformStaffUser extends AuthedUser {
  role: PlatformRole
}

/**
 * Гард маршрутов `/api/platform/…` (19.3.1 → 29.3.1, R-15): 401 без сессии, 403
 * `forbidden.root_only` не члену команды платформы, 403 `forbidden.platform_role` («Нет доступа к
 * разделу») роли вне списка. Роли маршрута — политика матрицы `PLATFORM_POLICIES`; каждый маршрут
 * описан в `platform-roles.integration.test.ts`. Роль читается из базы на каждый запрос.
 */
export async function requirePlatformRole(
  event: H3Event,
  ...roles: readonly PlatformRole[]
): Promise<PlatformStaffUser> {
  const user = await requireAuth(event)
  try {
    const role = await assertPlatformRole(
      { userId: user.id },
      roles.length ? roles : PLATFORM_ROLES,
    )
    return { ...user, role }
  } catch (e) {
    handleServiceError(e)
  }
}

/** Любой член команды платформы (страницы `/root/**`). */
export async function requireRootAdmin(event: H3Event): Promise<PlatformStaffUser> {
  return requirePlatformRole(event)
}

/** Ключи с контактами пользователей: Analyst их не получает ни в одном ответе (R-15). */
const CONTACT_KEY =
  /^(email|phone|telegram|telegramUsername|telegramUserId|.*Email|.*Phone|.*Telegram)$/

function stripContacts(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripContacts)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] =
        CONTACT_KEY.test(key) && (typeof v === 'string' || v === null) ? null : stripContacts(v)
    }
    return out
  }
  return value
}

/**
 * Ответ для роли: Analyst не видит персональных данных (R-15) — email, телефон и Telegram-имя
 * заменяются на `null` во всём ответе. Остальные роли получают ответ как есть.
 */
export function forPlatformRole<T>(staff: PlatformStaffUser, data: T): T {
  return staff.role === 'analyst' ? (stripContacts(data) as T) : data
}
