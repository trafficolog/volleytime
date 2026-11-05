import { dateToZonedInput, toMinor, zonedInputToDate } from '@volley-time/shared'

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

export type CollectionAction = 'edit' | 'publish' | 'complete' | 'cancel'

export interface CollectionMenuItem {
  key: CollectionAction
  label: string
  tone?: 'danger'
  separator?: boolean
}

/** Пункты меню строки по статусу; закрытый сбор (завершён, отменён) не меняется (409 `collection.not_active`). */
export function collectionMenuItems(status: DesktopCollection['status']): CollectionMenuItem[] {
  if (status === 'draft')
    return [
      { key: 'edit', label: 'Изменить' },
      { key: 'publish', label: 'Опубликовать' },
      { key: 'cancel', label: 'Отменить сбор', tone: 'danger', separator: true },
    ]
  if (status === 'active')
    return [
      { key: 'edit', label: 'Изменить' },
      { key: 'complete', label: 'Завершить сбор' },
      { key: 'cancel', label: 'Отменить сбор', tone: 'danger', separator: true },
    ]
  return []
}

/** Последствия отмены (`cancel.post`: обещания отклоняются, игроки уведомляются). */
export const COLLECTION_CANCEL_LINES = [
  'Ожидающие обещания будут отклонены, игроки получат уведомление.',
  'Уже подтверждённые взносы и касса не изменятся.',
  'Отменённый сбор нельзя вернуть.',
]

export const COLLECTION_COMPLETE_LINES = [
  'Новые взносы будут закрыты.',
  'Ожидающие обещания можно будет подтвердить или отклонить.',
]

/** Взнос из `GET …/collections/{id}` (21.2.4); даты — строки JSON. */
export interface DesktopContribution {
  id: number
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
  amount: number
  currency: string
  method: string
  status: string
  createdAt: string
  confirmedAt: string | null
}

export interface DesktopPledge extends DesktopContribution {
  collectionId: number
  collectionTitle: string
}

/** Ожидающие обещания сбора (только `pending`), в порядке ответа сервера (новые первыми). */
export function pendingPledges(
  collection: Pick<DesktopCollection, 'id' | 'title'>,
  contributions: readonly DesktopContribution[],
): DesktopPledge[] {
  return contributions
    .filter((c) => c.status === 'pending')
    .map((c) => ({ ...c, collectionId: collection.id, collectionTitle: collection.title }))
}

export function pledgePlayerName(user: DesktopContribution['user']): string {
  return user.name?.trim() || (user.telegramUsername ? `@${user.telegramUsername}` : 'Игрок')
}

export interface CollectionEditInput {
  title: string
  description: string
  icon: string
  target: string
  deadline: string
}

/** Дедлайн сбора как день `YYYY-MM-DD` в зоне группы (значение поля даты). */
export function collectionDeadlineDay(deadlineAt: string | null, tz: string): string {
  return deadlineAt ? dateToZonedInput(deadlineAt, tz).slice(0, 10) : ''
}

/** Цель сбора в основной единице валюты для поля формы; без цели — пустая строка. */
export function collectionTargetInput(targetAmount: number | null): string {
  if (targetAmount === null) return ''
  const major = targetAmount / 100
  return Number.isInteger(major) ? String(major) : major.toFixed(2).replace('.', ',')
}

/**
 * Тело PATCH …/collections/{id}. Нетронутый дедлайн не отправляется (прошедший дедлайн не должен
 * блокировать правку названия), очищенный уходит как `null`. Статус правкой не меняется.
 */
export function buildCollectionPatch(
  form: CollectionEditInput,
  initialDeadlineDay: string,
  tz: string,
  now = new Date(),
): { ok: true; body: Record<string, unknown> } | { ok: false; errors: FieldErrors } {
  const untouched = form.deadline === initialDeadlineDay
  const built = buildCollectionBody(
    { ...form, deadline: untouched ? '' : form.deadline, visibility: 'active' },
    tz,
    now,
  )
  if (!built.ok) return built
  const body = { ...built.body }
  delete body.status
  if (untouched) delete body.deadlineAt
  return { ok: true, body }
}
