/**
 * Тестовый двойник `GET …/events/{id}/price` для интеракционных тестов экрана события (20.4.6):
 * строит ответ тем же `quoteEventPrice`, что и сервер, из полей фикстуры события. Не часть приложения.
 */
import { quoteEventPrice } from '@volley-time/shared'

interface SplitEventFixture {
  capacity: number
  taken: number
  currency: string
  status?: string
  pricing: {
    mode: string
    targetAmount: number | null
    settledAt: string | null
    participantCount: number
    myAllocatedAmount: number | null
  }
  myBooking?: { status: string; seats?: number } | null
}

const ACTIVE = ['confirmed', 'pending_payment', 'attended', 'no_show']

export function splitPriceResponse(event: SplitEventFixture): { price?: unknown } {
  if (event.pricing.mode !== 'split' || event.status === 'cancelled') return {}
  const mine =
    event.myBooking && ACTIVE.includes(event.myBooking.status) ? (event.myBooking.seats ?? 1) : 0
  const taken = Math.min(event.taken, event.capacity)
  const quote = quoteEventPrice({
    mode: 'split',
    targetAmount: event.pricing.targetAmount ?? 10000,
    capacity: event.capacity,
    takenSeats: Math.max(taken, mine),
    mySeats: mine,
    seats: mine || 1,
    settled: event.pricing.settledAt
      ? {
          participantCount: event.pricing.participantCount,
          myAllocatedAmount: event.pricing.myAllocatedAmount,
        }
      : null,
  })
  return { price: { ...quote, currency: event.currency } }
}

type Fetch<Options> = (url: string, options?: Options) => Promise<unknown>

/** Блок цены читает `…/price` без параметров; запросы листа записи (`query.seats`) идут в `inner`. */
export function withSplitPriceFetch<Options>(
  inner: Fetch<Options>,
  event: () => SplitEventFixture,
): Fetch<Options> {
  return (url, options) =>
    url.endsWith('/price') && options === undefined
      ? Promise.resolve(splitPriceResponse(event()))
      : inner(url, options)
}
