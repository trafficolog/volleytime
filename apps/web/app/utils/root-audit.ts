import type {
  PlatformAuditCategory,
  PlatformAuditEntry,
  PlatformAuditPeriod,
} from '@volley-time/shared'

/** Фильтры журнала платформы (22.1.2): значения из полей формы, пустая строка — «все». */
export interface AuditFilters {
  period: PlatformAuditPeriod
  organizationId: string
  category: PlatformAuditCategory | ''
  q: string
}

export const AUDIT_PAGE_SIZE = 50

export const AUDIT_PERIOD_OPTIONS: { value: PlatformAuditPeriod; label: string }[] = [
  { value: '24h', label: 'Последние 24 часа' },
  { value: '7d', label: 'Последние 7 дней' },
  { value: '30d', label: 'Последние 30 дней' },
  { value: 'all', label: 'За всё время' },
]

export const AUDIT_CATEGORY_OPTIONS: { value: PlatformAuditCategory | ''; label: string }[] = [
  { value: '', label: 'Все категории' },
  { value: 'balance', label: 'Баланс' },
  { value: 'plans', label: 'Тарифы' },
  { value: 'organizations', label: 'Организации' },
  { value: 'settings', label: 'Настройки' },
]

/** Query запроса `/api/platform/audit`: пустые фильтры не отправляются. */
export function auditQuery(filters: AuditFilters, cursor?: number) {
  const q = filters.q.trim()
  const organizationId = Number(filters.organizationId)
  return {
    period: filters.period,
    ...(organizationId > 0 ? { organizationId } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(q ? { q } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
    limit: AUDIT_PAGE_SIZE,
  }
}

export function auditCounter(shown: number, total: number): string {
  if (total === 0) return 'Записей нет'
  return `Показано ${shown} из ${total.toLocaleString('ru-RU').replace(/\s/g, ' ')}`
}

const MAX_DETAILS = 160

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value) ?? String(value)
}

/** Краткое описание изменения: `поле: было → стало` для изменённых полей, `поле=значение` для новых. */
export function auditDetails(oldValue: unknown, newValue: unknown): string {
  if (newValue === null || newValue === undefined) return ''
  let text: string
  if (typeof newValue !== 'object' || Array.isArray(newValue)) {
    text = formatValue(newValue)
  } else {
    const before =
      oldValue && typeof oldValue === 'object' && !Array.isArray(oldValue)
        ? (oldValue as Record<string, unknown>)
        : {}
    text = Object.entries(newValue as Record<string, unknown>)
      .flatMap(([key, value]) => {
        if (!(key in before)) return [`${key}=${formatValue(value)}`]
        if (JSON.stringify(before[key]) === JSON.stringify(value)) return []
        return [`${key}: ${formatValue(before[key])} → ${formatValue(value)}`]
      })
      .join(' · ')
  }
  return text.length > MAX_DETAILS ? `${text.slice(0, MAX_DETAILS - 1)}…` : text
}

export interface AuditEntryView {
  id: number
  time: string
  title: string
  action: string
  actor: string
  target: string
  object: string
  details: string
}

/** Строка таблицы журнала. Часовой пояс — параметр, чтобы вывод не зависел от машины. */
export function auditEntryView(entry: PlatformAuditEntry, timeZone?: string): AuditEntryView {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(entry.createdAt))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const time = `${part('day')}.${part('month')} ${part('hour')}:${part('minute')}:${part('second')}`
  return {
    id: entry.id,
    time,
    title: new Date(entry.createdAt).toISOString(),
    action: entry.action,
    actor: entry.actor ? entry.actor.name || entry.actor.email || `#${entry.actor.id}` : 'system',
    target: entry.organization?.name || (entry.organization ? `#${entry.organization.id}` : '—'),
    object: `${entry.entityType} #${entry.entityId}`,
    details: auditDetails(entry.oldValue, entry.newValue),
  }
}
