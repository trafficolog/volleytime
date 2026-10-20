/**
 * Блок цены карточки события в кабинете (20.5.6, W-05). Цена — только из ответа
 * `GET …/events/{id}/price` (`quoteEventPrice`, 20.1.1), а не из `readEventPricing`/`previewSplitAmount`
 * (D-01 (B)). «Мест нет» определяется занятостью события, а не ценой: `seatCount.current` ограничен
 * вместимостью (ревью 20.1.1). Для отменённого события цена не показывается.
 */
import { quoteEventPrice, type EventPriceQuote } from '@volley-time/shared'

import { seatsLabel } from './booking-seats'
import { formatMoneyRu } from './labels'
import { eventStateOf, seatsOf } from './status-model'

export interface PriceScenario {
  seats: number
  amount: string
  /** Колонка «сейчас» — совпадает с верхней границей ответа эндпоинта. */
  current: boolean
}

export interface PriceView {
  mode: 'fixed' | 'split'
  basis: EventPriceQuote['basis']
  headline: string
  /** «от … до …» — только когда границы прогноза различаются. */
  rangeText: string | null
  /** «100,00 BYN ÷ 8 мест». */
  divider: string | null
  /** Прогноз при другом наполнении (доли сбора); только для split до закрытия. */
  scenarios: PriceScenario[]
  full: boolean
}

export interface PriceEventState {
  status: string
  startsAt: string | Date
  endsAt?: string | Date | null
  capacity: number
  /** Занятые места события (`taken` из статистики, не игроки). */
  taken: number
}

export function priceViewOf(
  quote: EventPriceQuote | null | undefined,
  currency: string,
  event: PriceEventState,
  now: Date = new Date(),
): PriceView | null {
  if (!quote || event.status === 'cancelled') return null
  const state = eventStateOf(event, now)
  const full = seatsOf({ taken: event.taken, capacity: event.capacity }, state).full && !state
  const money = (minor: number) => formatMoneyRu(minor, currency)

  if (quote.mode === 'fixed') {
    return {
      mode: 'fixed',
      basis: quote.basis,
      headline: money(quote.perSeat.max),
      rangeText: null,
      divider: null,
      scenarios: [],
      full,
    }
  }

  if (quote.basis === 'settled') {
    return {
      mode: 'split',
      basis: 'settled',
      headline: money(quote.perSeat.max),
      rangeText:
        quote.perSeat.min !== quote.perSeat.max
          ? `от ${money(quote.perSeat.min)} до ${money(quote.perSeat.max)}`
          : null,
      divider:
        quote.targetAmount !== null && quote.seatCount
          ? `${money(quote.targetAmount)} ÷ ${seatsLabel(quote.seatCount.current)}`
          : null,
      scenarios: [],
      full,
    }
  }

  const target = quote.targetAmount ?? 0
  const current = quote.seatCount?.current ?? 0
  const max = quote.seatCount?.max ?? event.capacity
  const counts = [
    ...new Set([current, Math.min(max, current + 2), Math.min(max, current + 4), max]),
  ]
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
  return {
    mode: 'split',
    basis: quote.basis,
    headline: `≈ ${money(quote.perSeat.max)}`,
    rangeText:
      quote.perSeat.min !== quote.perSeat.max
        ? `от ${money(quote.perSeat.min)} до ${money(quote.perSeat.max)}`
        : null,
    divider: `${money(target)} ÷ ${seatsLabel(current)}`,
    // та же функция расчёта, что и в ответе эндпоинта: n мест, одно из них — «моё»
    scenarios: counts.map((n) => ({
      seats: n,
      amount: money(
        quoteEventPrice({
          mode: 'split',
          targetAmount: target,
          capacity: max,
          takenSeats: n,
          mySeats: 1,
          seats: 1,
          settled: null,
        }).perSeat.max,
      ),
      current: n === current,
    })),
    full,
  }
}
