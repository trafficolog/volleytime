/**
 * Строка списка событий кабинета (W-03, 20.5.8): колонка «Оплаты», пункты меню ⋯ и копия события
 * для «Дублировать». Только представление: суммы и цена места приходят из `GET …/events`
 * (`paymentTotals`, `splitShareQuote` = `quoteEventPrice`), здесь они не пересчитываются.
 */
import { dateToZonedInput, zonedInputToDate } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import type { VtPopoverItem } from '~/components/vt/Popover.vue'
import { formatMoneyRu } from '~/utils/labels'

export interface PaymentsCell {
  /** «10,00 BYN»; `null` — суммы не пришли (нет прав) или платить нечего. */
  paid: string | null
  /** «+5,00 BYN» — ждёт оплаты. */
  pending: string | null
  /** «≈ 33,34 BYN за место» до закрытия, «33,34 BYN за место» после; только для делёжа суммы. */
  share: string | null
}

export function paymentsCellOf(event: EventListItem): PaymentsCell {
  const totals = event.paymentTotals
  const currency = totals?.currency ?? event.currency
  const split = event.priceMode === 'split' || event.pricing?.mode === 'split'
  const nothingToPay = !split && event.price === 0 && totals?.paid === 0 && totals.pending === 0
  const quote = event.splitShareQuote
  return {
    paid: totals && !nothingToPay ? formatMoneyRu(totals.paid, currency) : null,
    pending: totals && totals.pending > 0 ? `+${formatMoneyRu(totals.pending, currency)}` : null,
    // отменённому событию цена места не нужна; недоступный расчёт — без числа
    share:
      quote?.mode === 'split' && event.status !== 'cancelled'
        ? `${quote.basis === 'settled' ? '' : '≈ '}${formatMoneyRu(quote.perSeat.max, quote.currency ?? event.currency)} за место`
        : null,
  }
}

/** Привязка группового чата для пункта «В чат группы» (20.3.4). */
export type ChatLinkState =
  | { kind: 'unknown' }
  | { kind: 'active' }
  | { kind: 'none' }
  | { kind: 'invalid'; reason: string | null }
  | { kind: 'error' }

/** Ответ `GET …/telegram-chat` → состояние пункта меню; `null` — запрос не удался. */
export function chatLinkStateOf(
  response: { link: { status: string; invalidReason?: string | null } | null } | null,
): ChatLinkState {
  if (!response) return { kind: 'error' }
  const link = response.link
  if (!link) return { kind: 'none' }
  return link.status === 'active'
    ? { kind: 'active' }
    : { kind: 'invalid', reason: link.invalidReason ?? null }
}

function chatHint(chat: ChatLinkState): string | null {
  switch (chat.kind) {
    case 'active':
      return null
    case 'none':
      return 'Чат группы не привязан'
    case 'invalid':
      return chat.reason === 'migrated'
        ? 'Чат перенесён: привяжите заново'
        : 'У бота нет права писать в чат'
    case 'error':
      return 'Не удалось проверить чат'
    default:
      return 'Проверяем привязку чата…'
  }
}

export type RowAction = 'open' | 'duplicate' | 'announce' | 'cancel'

/** Анонс доступен для опубликованного события, которое ещё не началось (как `announceEvent`). */
export function isAnnounceable(event: Pick<EventListItem, 'status' | 'startsAt'>, now: Date) {
  return event.status === 'published' && new Date(event.startsAt) > now
}

export function rowMenuItems(
  event: EventListItem,
  chat: ChatLinkState,
  now: Date,
): VtPopoverItem[] {
  const hint = isAnnounceable(event, now)
    ? chatHint(chat)
    : 'Анонс — для будущего опубликованного события'
  const items: VtPopoverItem[] = [
    { key: 'open', label: 'Открыть событие' },
    { key: 'duplicate', label: 'Дублировать' },
    { key: 'announce', label: 'В чат группы', disabled: hint !== null, hint: hint ?? undefined },
  ]
  if (event.status !== 'cancelled')
    items.push({ key: 'cancel', label: 'Отменить событие', tone: 'danger', separator: true })
  return items
}

const WEEK_MS = 7 * 86_400_000

/** Сдвиг на `weeks` календарных недель в часовом поясе группы с тем же местным временем. */
export function shiftWeeks(iso: string, timeZone: string, weeks: number): string {
  const [date, time] = dateToZonedInput(iso, timeZone).split('T') as [string, string]
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + weeks * WEEK_MS)
    .toISOString()
    .slice(0, 10)
  return zonedInputToDate(`${next}T${time}`, timeZone).toISOString()
}

/** Сколько недель прибавить, чтобы начало копии оказалось в будущем (минимум одна). */
export function weeksToFuture(startsAt: string, timeZone: string, now: Date): number {
  let weeks = Math.max(1, Math.ceil((now.getTime() - new Date(startsAt).getTime()) / WEEK_MS))
  // переход на летнее/зимнее время сдвигает момент на час: добираем недостающую неделю
  while (new Date(shiftWeeks(startsAt, timeZone, weeks)) <= now) weeks++
  return weeks
}

/**
 * Тело `POST …/events` для копии (карточка 20.5.8): название, зал, места, цена, режим записи,
 * то же местное время, дата +N недель (ближайшая в будущем, минимум +7 дней), валюта события, черновик (баланс не списывается, D-04). Время открытия записи не
 * переносится.
 */
export function duplicateEventBody(
  event: EventListItem,
  timeZone: string,
  now: Date = new Date(),
): Record<string, unknown> {
  const weeks = weeksToFuture(event.startsAt, timeZone, now)
  const body: Record<string, unknown> = {
    type: event.type,
    title: event.title,
    description: event.description ?? undefined,
    venueId: event.venueId ?? undefined,
    locationText: event.locationText ?? undefined,
    startsAt: shiftWeeks(event.startsAt, timeZone, weeks),
    endsAt: shiftWeeks(event.endsAt, timeZone, weeks),
    currency: event.currency,
    capacity: event.capacity,
    priceMode: event.priceMode,
    price: event.price,
    targetAmount: event.priceMode === 'split' ? (event.targetAmount ?? null) : undefined,
    level: event.level ?? undefined,
    joinMode: event.joinMode,
    closeBeforeMinutes: event.closeBeforeMinutes,
    status: 'draft',
  }
  for (const key of Object.keys(body)) if (body[key] === undefined) delete body[key]
  return body
}
