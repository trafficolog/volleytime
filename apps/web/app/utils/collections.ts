import { formatMoneyRu } from './labels'

/** Сбор в виде, который отдаёт `GET /api/organizations/{orgId}/collections` (21.2.4). */
export interface PlayerCollection {
  id: number
  title: string
  description: string | null
  icon: string
  /** Минорные единицы валюты группы. */
  targetAmount: number | null
  currency: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  deadlineAt: string | null
  createdAt: string
  closedAt: string | null
  createdBy: { id: number; name: string | null }
  /** Подтверждённые взносы = поступления кассы по сбору. */
  collected: number
  pledged: number
  contributors: number
  my: MyContribution
}

export interface MyContribution {
  paid: number
  pending: { id: number; amount: number; method: 'cash' | 'transfer' | string } | null
}

export interface CollectionContribution {
  id: number
  user: { id: number; name: string | null; telegramUsername: string | null; image: string | null }
  amount: number
  currency: string
  method: string
  status: string
  createdAt: string
  confirmedAt: string | null
}

/** Потолок одного взноса сервера (`MAX_CONTRIBUTION_AMOUNT`), минорные единицы. */
const MAX_PLEDGE_MINOR = 10_000_000

export function collectionProgress(collected: number, target: number | null): number | null {
  if (target === null || target <= 0) return null
  return Math.min(100, Math.round((collected / target) * 100))
}

export function collectionSections<T extends Pick<PlayerCollection, 'status'>>(list: readonly T[]) {
  return {
    active: list.filter((c) => c.status === 'active'),
    finished: list.filter((c) => c.status !== 'active'),
  }
}

export function collectionMyStatus(
  my: MyContribution,
  currency: string,
): { tone: 'amber' | 'grass'; label: string } | null {
  if (my.pending) {
    return { tone: 'amber', label: `обещано ${formatMoneyRu(my.pending.amount, currency)}` }
  }
  if (my.paid > 0) return { tone: 'grass', label: `внесли ${formatMoneyRu(my.paid, currency)}` }
  return null
}

/** Дедлайн только для показа: сбор закрывает организатор вручную (решение владельца 2026-10-28). */
export function collectionDeadlineLabel(
  deadlineAt: string | null,
  timeZone: string,
  now = new Date(),
): { date: string; left: string } | null {
  if (!deadlineAt) return null
  const deadline = new Date(deadlineAt)
  const date = new Intl.DateTimeFormat('ru-RU', { timeZone, day: 'numeric', month: 'long' }).format(
    deadline,
  )
  const days = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000)
  return { date: `до ${date}`, left: days > 0 ? `осталось ${days} дн.` : 'срок прошёл' }
}

export function collectionCtaLabel(my: MyContribution): string {
  if (my.pending) return 'Заменить обещанный взнос'
  return my.paid > 0 ? 'Внести ещё' : 'Внести взнос'
}

/** Сумма из поля в основной единице валюты («12,5») → минорные единицы; null — невалидно. */
export function parsePledgeAmount(text: string): number | null {
  const match = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(text.trim())
  if (!match) return null
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return minor >= 1 && minor <= MAX_PLEDGE_MINOR ? minor : null
}

export function pledgeToastText(amount: number, currency: string, replaced: boolean): string {
  const sum = formatMoneyRu(amount, currency)
  return replaced
    ? `Обещание заменено на ${sum} · ждём подтверждения`
    : `Обещано ${sum} · ждём подтверждения`
}

export const COLLECTION_METHOD_LABELS: Record<'cash' | 'transfer', string> = {
  cash: 'наличными',
  transfer: 'переводом',
}
