import { quoteEventPrice } from '@volley-time/shared'

/**
 * Прогноз цены места при полном составе для формы события (W-04, D-01 (B)): единый расчёт
 * `quoteEventPrice` — тот же, что отдаёт `GET …/events/{id}/price` для Mini App, карточки события и
 * публичной страницы. Событие ещё не создано, поэтому состав моделируем: заняты все места, одно из
 * них — «моё» (одно место игрока). Деньги — целые минимальные единицы.
 */
export function fullRosterForecast(
  targetAmount: number,
  capacity: number,
): { min: number; max: number } {
  const quote = quoteEventPrice({
    mode: 'split',
    targetAmount,
    capacity,
    takenSeats: capacity,
    mySeats: 1,
    seats: 1,
    settled: null,
  })
  return quote.perSeat
}
