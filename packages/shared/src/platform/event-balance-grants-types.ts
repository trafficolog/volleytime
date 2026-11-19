/**
 * Ручное начисление баланса событий root-администратором (22.2.2, R-03): форма ответов
 * `/api/platform/organizations/{id}/event-balance-grants` и `/api/platform/event-balance/grants`.
 * Единица — «событие» (D-10).
 */

export const PLATFORM_GRANT_CATEGORIES = ['promo', 'compensation', 'bugfix', 'manual'] as const
export type PlatformGrantCategory = (typeof PLATFORM_GRANT_CATEGORIES)[number]

/** Предел одного начисления: защита от опечатки (как у операторской команды). */
export const PLATFORM_GRANT_MAX_UNITS = 1000
export const PLATFORM_GRANT_COMMENT_MIN = 3
export const PLATFORM_GRANT_COMMENT_MAX = 500

export interface PlatformGrantResult {
  entryId: number
  organization: { id: number; name: string }
  delta: number
  balanceAfter: number
  category: PlatformGrantCategory | null
  comment: string
  createdAt: string
  /** `true` — повтор той же отправки (тот же ключ): баланс не менялся второй раз. */
  replayed: boolean
}

export interface PlatformGrantRow {
  id: number
  createdAt: string
  organization: { id: number; name: string }
  delta: number
  balanceAfter: number
  /** `null` — начисление сделано операторской командой без категории. */
  category: PlatformGrantCategory | null
  comment: string | null
  actor: { id: number; name: string; email: string | null } | null
}

export interface PlatformGrantsPage {
  entries: PlatformGrantRow[]
  /** id последней записи страницы; `null` — страниц больше нет. */
  nextCursor: number | null
}
