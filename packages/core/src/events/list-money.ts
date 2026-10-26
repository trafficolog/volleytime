import { and, bookings, eq, events, inArray, payments, sql, type Event } from '@volley-time/db'
import { quoteEventPrice } from '@volley-time/shared'

import { getDb, type ServiceContext } from '../shared/context'

import type { EventPriceQuoteView } from './pricing-read-model'

/** Деньги события в списке кабинета (20.5.8): оплачено и ждёт оплаты, в минимальных единицах. */
export interface EventListMoney {
  paid: number
  pending: number
  currency: string
}

type MoneyEvent = Pick<Event, 'id' | 'currency'>

/**
 * Суммы платежей событий страницы списка одним запросом (без N+1). Правила те же, что у
 * `readPricingFinancials` (касса и карточка события): платежи записей события, организация платежа
 * = организация события, валюта платежа = валюта события; `succeeded` — оплачено, `pending` —
 * ждёт оплаты, отменённые и возвращённые в суммы не входят.
 */
export async function readEventListMoney(
  ctx: ServiceContext,
  list: readonly MoneyEvent[],
): Promise<Map<number, EventListMoney>> {
  const out = new Map<number, EventListMoney>(
    list.map((e) => [e.id, { paid: 0, pending: 0, currency: e.currency }]),
  )
  if (list.length === 0) return out
  const rows = await getDb(ctx)
    .select({
      eventId: bookings.eventId,
      // bigint приходит строкой: сумма копеек по событию не ограничена int4
      paid: sql<string>`coalesce(sum(${payments.amount}) FILTER (WHERE ${payments.status} = 'succeeded'), 0)`,
      pending: sql<string>`coalesce(sum(${payments.amount}) FILTER (WHERE ${payments.status} = 'pending'), 0)`,
    })
    .from(payments)
    .innerJoin(bookings, eq(bookings.id, payments.bookingId))
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(
      and(
        inArray(
          bookings.eventId,
          list.map((e) => e.id),
        ),
        eq(payments.organizationId, events.organizationId),
        eq(payments.currency, events.currency),
      ),
    )
    .groupBy(bookings.eventId)
  for (const row of rows) {
    const money = out.get(row.eventId)
    if (money) {
      money.paid = Number(row.paid)
      money.pending = Number(row.pending)
    }
  }
  return out
}

type SplitShareEvent = Pick<
  Event,
  | 'id'
  | 'currency'
  | 'priceMode'
  | 'targetAmount'
  | 'capacity'
  | 'pricingSettledAt'
  | 'pricingParticipantCount'
>

/**
 * Цена места split для списка организатора (20.5.8): тот же `quoteEventPrice`, что `GET …/price`
 * для игрока с одним местом, при текущем составе (занято мест — `taken`, из `statsFor`). Это цена на
 * участника сейчас, а не прогноз «если запишетесь»: при непустом составе одно из мест считается
 * местом участника (`mySeats` 1), при пустом — гипотетическим единственным. После закрытия записи —
 * снимок (`settled`). Не split и невозможные числа — `null`.
 */
export function quoteSplitShare(event: SplitShareEvent, taken: number): EventPriceQuoteView | null {
  if (event.priceMode !== 'split' || event.targetAmount === null) return null
  try {
    const quote = quoteEventPrice({
      mode: 'split',
      targetAmount: event.targetAmount,
      capacity: event.capacity,
      // занятость выше вместимости (уменьшенная вместимость) не должна ронять список
      takenSeats: Math.min(taken, event.capacity),
      mySeats: taken > 0 ? 1 : 0,
      seats: 1,
      settled:
        event.pricingSettledAt !== null
          ? { participantCount: event.pricingParticipantCount!, myAllocatedAmount: null }
          : null,
    })
    return { ...quote, currency: event.currency }
  } catch (error) {
    if (error instanceof RangeError) {
      console.warn('[price] split share unavailable', { eventId: event.id, error })
      return null
    }
    throw error
  }
}
