import {
  collectionDeadlineIso,
  parseCollectionTarget,
  type DesktopCollection,
} from './desktop-collections'

/** Сбор и взносы для экранов организатора (21.1.5); поля — как отдаёт API 21.2.4. */
export type ManagedCollection = DesktopCollection & {
  createdBy?: { id: number; name: string | null }
}

export interface ManagedContribution {
  id: number
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
  amount: number
  currency: string
  method: string
  status: string
  createdAt: string
  confirmedAt: string | null
}

export function isManagerMember(member: { role: string; status: string } | null | undefined) {
  return member?.status === 'active' && ['owner', 'organizer'].includes(member.role)
}

/**
 * Итоги списка: «Активных» и «Собрано всего». Отменённые сборы в сумму не входят: их ожидающие
 * взносы отклонены, а сбор уже не считается кампанией.
 */
export function organizerSummary(
  items: readonly Pick<ManagedCollection, 'status' | 'collected'>[],
) {
  return {
    active: items.filter((c) => c.status === 'active').length,
    collected: items.filter((c) => c.status !== 'cancelled').reduce((s, c) => s + c.collected, 0),
  }
}

/** Секции списка организатора: черновики, активные, завершённые и отменённые. */
export function organizerSections<T extends Pick<ManagedCollection, 'status'>>(list: readonly T[]) {
  return {
    draft: list.filter((c) => c.status === 'draft'),
    active: list.filter((c) => c.status === 'active'),
    finished: list.filter((c) => c.status === 'completed' || c.status === 'cancelled'),
  }
}

/** Ожидающие обещания и подтверждённые взносы; порядок API (новые сверху) сохраняется. */
export function splitContributions<T extends Pick<ManagedContribution, 'status'>>(
  list: readonly T[],
) {
  return {
    pending: list.filter((c) => c.status === 'pending'),
    paid: list.filter((c) => c.status === 'succeeded'),
  }
}

/** Сколько осталось до цели; без цели — null, при перевыполнении — 0. */
export function collectionRemaining(c: Pick<ManagedCollection, 'collected' | 'targetAmount'>) {
  if (c.targetAmount === null) return null
  return Math.max(0, c.targetAmount - c.collected)
}

/**
 * Действия над сбором. Решение по обещаниям, завершение и отмена работают и при выключенном
 * `COLLECTIONS_ENABLED` (существующее можно разобрать и закрыть); создание, публикация и правка
 * скрыты. Обещания можно разбирать и у завершённого сбора (`complete()` их не трогает); у
 * отменённого их уже нет.
 */
export function collectionActions(
  c: Pick<ManagedCollection, 'status'>,
  flagOn: boolean,
): { publish: boolean; edit: boolean; complete: boolean; cancel: boolean; decide: boolean } {
  const open = c.status === 'draft' || c.status === 'active'
  return {
    publish: flagOn && c.status === 'draft',
    edit: flagOn && open,
    complete: c.status === 'active',
    cancel: open,
    decide: c.status === 'active' || c.status === 'completed',
  }
}

export interface CollectionEditForm {
  title: string
  description: string
  icon: string
  target: string
  deadline: string
}

type FieldErrors = Partial<Record<'title' | 'target' | 'deadline', string>>

/** День дедлайна в формате `YYYY-MM-DD` для поля даты, в часовом поясе группы. */
export function deadlineInputValue(deadlineAt: string | null, tz: string): string {
  if (!deadlineAt) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(deadlineAt))
}

/** Цель в основной единице валюты для поля формы: 25000 → «250», 25050 → «250,5». */
export function targetInputValue(minor: number | null): string {
  if (minor === null) return ''
  return String(minor / 100).replace('.', ',')
}

/**
 * Тело PATCH: только изменённые поля (схема строгая, а дедлайн должен быть в будущем, поэтому
 * неизменённый прошедший дедлайн не отправляется). Нет изменений — `body: {}`.
 */
export function buildCollectionPatch(
  original: Pick<
    ManagedCollection,
    'title' | 'description' | 'icon' | 'targetAmount' | 'deadlineAt'
  >,
  form: CollectionEditForm,
  tz: string,
  now = new Date(),
): { ok: true; body: Record<string, unknown> } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const body: Record<string, unknown> = {}
  const title = form.title.trim()
  if (title.length < 1 || title.length > 120) errors.title = 'Название: от 1 до 120 символов'
  else if (title !== original.title) body.title = title

  const description = form.description.trim() || null
  if (description !== (original.description?.trim() || null)) body.description = description

  if (form.icon !== original.icon) body.icon = form.icon

  const target = parseCollectionTarget(form.target)
  if (!target.ok) errors.target = 'Укажите сумму больше нуля, например 250 или 250,50'
  else if (target.value !== original.targetAmount) body.targetAmount = target.value

  if (form.deadline !== deadlineInputValue(original.deadlineAt, tz)) {
    if (form.deadline === '') body.deadlineAt = null
    else {
      const iso = collectionDeadlineIso(form.deadline, tz, now)
      if (iso) body.deadlineAt = iso
      else errors.deadline = 'Дедлайн должен быть в будущем'
    }
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, body }
}
