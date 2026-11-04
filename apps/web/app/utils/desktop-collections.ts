import { toMinor, zonedInputToDate } from '@volley-time/shared'

/** Сбор из `GET /api/organizations/{orgId}/collections` (21.2.4); даты приходят строками JSON. */
export interface DesktopCollection {
  id: number
  title: string
  description: string | null
  icon: string
  targetAmount: number | null
  currency: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  deadlineAt: string | null
  closedAt: string | null
  collected: number
  pledged: number
  contributors: number
}

export const COLLECTION_ICON_KEYS = ['ball', 'trophy', 'shirt', 'arena', 'party', 'bus'] as const
export type CollectionIconKey = (typeof COLLECTION_ICON_KEYS)[number]

/** Подписи и цвета иконок сбора из макета (`CAMPAIGN_ICONS`). */
export const COLLECTION_ICON_META: Record<
  CollectionIconKey,
  { label: string; bg: string; fg: string }
> = {
  ball: { label: 'Мячи / инвентарь', bg: 'var(--vt-orange-soft)', fg: 'var(--vt-orange-ink)' },
  trophy: { label: 'Турнир', bg: 'var(--vt-blue-soft-tile)', fg: 'var(--vt-flame-deep)' },
  shirt: { label: 'Форма', bg: 'var(--vt-grass-soft)', fg: 'var(--vt-grass-ink)' },
  arena: { label: 'Аренда зала', bg: 'var(--vt-bone-2)', fg: 'var(--vt-ink-3)' },
  party: { label: 'Праздник', bg: 'var(--vt-amber-soft)', fg: 'var(--vt-amber-ink)' },
  bus: { label: 'Выезд', bg: 'var(--vt-rose-soft)', fg: 'var(--vt-rose-ink)' },
}

export function collectionIconMeta(icon: string) {
  return COLLECTION_ICON_META[icon as CollectionIconKey] ?? COLLECTION_ICON_META.ball
}

export const COLLECTION_STATUS_LABELS: Record<DesktopCollection['status'], string> = {
  draft: 'черновик',
  active: 'активен',
  completed: 'завершён',
  cancelled: 'отменён',
}

/** Процент цели для шкалы; сбор без цели шкалы не имеет. */
export function collectionProgress(c: Pick<DesktopCollection, 'collected' | 'targetAmount'>) {
  if (!c.targetAmount) return null
  return Math.min(100, Math.round((c.collected / c.targetAmount) * 100))
}

/**
 * Итоги по загруженным сборам. Отменённые сборы в суммы не входят (их ожидающие взносы
 * отклонены). У завершённых сборов ожидающие взносы сохраняются (`complete()` их не трогает) и ещё
 * могут быть подтверждены или отклонены, поэтому «обещано» считается по всем неотменённым.
 */
export function collectionTotals(items: readonly DesktopCollection[]) {
  const live = items.filter((c) => c.status !== 'cancelled')
  return {
    active: items.filter((c) => c.status === 'active').length,
    collected: live.reduce((sum, c) => sum + c.collected, 0),
    pledged: live.reduce((sum, c) => sum + c.pledged, 0),
  }
}

const MAX_TARGET = 2_147_483_647

/** Целевая сумма в основной единице валюты → minor units; пусто → null (сбор без цели). */
export function parseCollectionTarget(
  raw: string,
): { ok: true; value: number | null } | { ok: false } {
  const text = raw.trim()
  if (text === '') return { ok: true, value: null }
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) return { ok: false }
  const value = toMinor(Number(text.replace(',', '.')))
  return value >= 1 && value <= MAX_TARGET ? { ok: true, value } : { ok: false }
}

/** Дедлайн — только отображение (решение 2026-10-28): 23:59 выбранного дня в зоне группы (минута, не последняя миллисекунда). */
export function collectionDeadlineIso(day: string, tz: string, now = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const end = zonedInputToDate(`${day}T23:59`, tz)
  return end.getTime() > now.getTime() ? end.toISOString() : null
}

export interface CollectionFormInput {
  title: string
  description: string
  icon: string
  target: string
  deadline: string
  visibility: 'active' | 'draft'
}

type FieldErrors = Partial<Record<'title' | 'target' | 'deadline', string>>

/** Тело POST …/collections либо тексты ошибок полей. */
export function buildCollectionBody(
  form: CollectionFormInput,
  tz: string,
  now = new Date(),
): { ok: true; body: Record<string, unknown> } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const title = form.title.trim()
  if (title.length < 1 || title.length > 120) errors.title = 'Название: от 1 до 120 символов'
  const target = parseCollectionTarget(form.target)
  if (!target.ok) errors.target = 'Укажите сумму больше нуля, например 250 или 250,50'
  let deadlineAt: string | null = null
  if (form.deadline) {
    deadlineAt = collectionDeadlineIso(form.deadline, tz, now)
    if (!deadlineAt) errors.deadline = 'Дедлайн должен быть в будущем'
  }
  if (Object.keys(errors).length > 0 || !target.ok) return { ok: false, errors }
  return {
    ok: true,
    body: {
      title,
      description: form.description.trim() || null,
      icon: form.icon,
      targetAmount: target.value,
      deadlineAt,
      status: form.visibility,
    },
  }
}
