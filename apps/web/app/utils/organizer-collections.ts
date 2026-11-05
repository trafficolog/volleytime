import {
  collectionDeadlineDay,
  collectionDeadlineIso,
  parseCollectionTarget,
  type CollectionEditInput,
  type DesktopCollection,
} from './desktop-collections'

/**
 * Помощники экранов организатора Mini App (21.1.5). Общая логика сборов — в `desktop-collections`
 * (итоги, меню по статусу, обещания, поля формы); здесь только то, чего там нет.
 */

export function isManagerMember(member: { role: string; status: string } | null | undefined) {
  return member?.status === 'active' && ['owner', 'organizer'].includes(member.role)
}

/** Секции списка организатора: черновики, активные, завершённые и отменённые. */
export function organizerSections<T extends Pick<DesktopCollection, 'status'>>(list: readonly T[]) {
  return {
    draft: list.filter((c) => c.status === 'draft'),
    active: list.filter((c) => c.status === 'active'),
    finished: list.filter((c) => c.status === 'completed' || c.status === 'cancelled'),
  }
}

/** Подтверждённые взносы; порядок API (новые сверху) сохраняется. */
export function paidContributions<T extends { status: string }>(list: readonly T[]) {
  return list.filter((c) => c.status === 'succeeded')
}

/** Сколько осталось до цели; без цели — null, при перевыполнении — 0. */
export function collectionRemaining(c: Pick<DesktopCollection, 'collected' | 'targetAmount'>) {
  if (c.targetAmount === null) return null
  return Math.max(0, c.targetAmount - c.collected)
}

/**
 * Обещания можно подтверждать и отклонять у активного и завершённого сбора (`complete()` их не
 * трогает); у черновика их нет, у отменённого они уже отклонены. Работает и при выключенном флаге.
 */
export function canDecidePledges(status: DesktopCollection['status']): boolean {
  return status === 'active' || status === 'completed'
}

/**
 * Тело PATCH только из изменённых полей (схема строгая, а дедлайн должен быть в будущем, поэтому
 * неизменённый прошедший дедлайн не отправляется). Нет изменений — `body: {}`.
 */
export function buildChangedCollectionPatch(
  original: Pick<
    DesktopCollection,
    'title' | 'description' | 'icon' | 'targetAmount' | 'deadlineAt'
  >,
  form: CollectionEditInput,
  tz: string,
  now = new Date(),
):
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; errors: Partial<Record<'title' | 'target' | 'deadline', string>> } {
  const errors: Partial<Record<'title' | 'target' | 'deadline', string>> = {}
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

  if (form.deadline !== collectionDeadlineDay(original.deadlineAt, tz)) {
    if (form.deadline === '') body.deadlineAt = null
    else {
      const iso = collectionDeadlineIso(form.deadline, tz, now)
      if (iso) body.deadlineAt = iso
      else errors.deadline = 'Дедлайн должен быть в будущем'
    }
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, body }
}
