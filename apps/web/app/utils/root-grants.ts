import {
  PLATFORM_GRANT_COMMENT_MAX,
  PLATFORM_GRANT_COMMENT_MIN,
  PLATFORM_GRANT_MAX_UNITS,
  type PlatformGrantCategory,
  type PlatformGrantRow,
} from '@volley-time/shared'

import { pluralEvents } from './cabinet-shell'

/**
 * Выдача баланса организации (22.2.2, R-03). Единица — «событие» (D-10): английский термин макета
 * не переносится. Границы формы совпадают с проверкой API.
 */

export const GRANT_PRESETS = [1, 5, 10, 30] as const

export const GRANT_CATEGORY_LABELS: Record<PlatformGrantCategory, string> = {
  promo: 'Промо',
  compensation: 'Компенсация',
  bugfix: 'Багфикс',
  manual: 'Вручную',
}

export interface GrantForm {
  units: string
  category: PlatformGrantCategory
  comment: string
}

export type GrantFormErrors = Partial<Record<'units' | 'comment', string>>

export function parseGrantUnits(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d{1,4}$/.test(text)) return null
  const n = Number(text)
  return n >= 1 && n <= PLATFORM_GRANT_MAX_UNITS ? n : null
}

export function grantFormErrors(form: GrantForm): GrantFormErrors {
  const errors: GrantFormErrors = {}
  if (parseGrantUnits(form.units) === null) {
    errors.units = `Целое число событий от 1 до ${PLATFORM_GRANT_MAX_UNITS}`
  }
  const comment = form.comment.trim()
  if (comment.length < PLATFORM_GRANT_COMMENT_MIN) {
    errors.comment = 'Укажите причину: без неё начисление невозможно'
  } else if (comment.length > PLATFORM_GRANT_COMMENT_MAX) {
    errors.comment = `Не длиннее ${PLATFORM_GRANT_COMMENT_MAX} символов`
  }
  return errors
}

/** Тело запроса; `key` — UUID, один на открытие формы: повторная отправка не начислит дважды. */
export function grantBody(form: GrantForm, key: string) {
  return {
    units: parseGrantUnits(form.units) as number,
    category: form.category,
    comment: form.comment.trim(),
    idempotencyKey: key,
  }
}

/** «42 события»: баланс после выдачи; некорректное количество не прибавляется. */
export function balanceAfterLabel(current: number, units: number): string {
  const total = current + (Number.isFinite(units) && units > 0 ? units : 0)
  return `${total} ${pluralEvents(total)}`
}

const ERROR_MESSAGES: Record<string, string> = {
  'organization.not_found': 'Организация не найдена',
  'platform.grant_org_deleted': 'Организация удалена: начислять баланс нельзя до восстановления',
  'platform.grant_idempotency_conflict':
    'Эта отправка уже обработана с другими данными. Обновите страницу и повторите',
  validation_failed: 'Проверьте заполнение полей',
}

export function grantErrorMessage(code: string | undefined): string {
  return (code && ERROR_MESSAGES[code]) || 'Не удалось выдать баланс. Попробуйте ещё раз'
}

export interface GrantRowView {
  id: number
  time: string
  isoTime: string
  organization: string
  organizationId: number
  amount: string
  reason: string
  actor: string
}

/** Строка списка начислений. Часовой пояс — параметр, чтобы вывод не зависел от машины. */
export function grantRowView(row: PlatformGrantRow, timeZone?: string): GrantRowView {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(row.createdAt))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const label = row.category ? GRANT_CATEGORY_LABELS[row.category] : null
  const reason = row.comment ? (label ? `${label}: ${row.comment}` : row.comment) : (label ?? '—')
  return {
    id: row.id,
    time: `${part('day')}.${part('month')} ${part('hour')}:${part('minute')}`,
    isoTime: new Date(row.createdAt).toISOString(),
    organization: row.organization.name,
    organizationId: row.organization.id,
    amount: `+${row.delta}`,
    reason,
    actor: row.actor ? row.actor.name || row.actor.email || `#${row.actor.id}` : 'system',
  }
}
