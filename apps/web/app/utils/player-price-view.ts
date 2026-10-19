/**
 * Цена split для игрока (20.4.6, M-07): экран события и Главная. Все суммы берутся только из ответа
 * `GET …/events/{id}/price` (`quoteEventPrice`, 20.1.1, D-01 (B)), а не из `readEventPricing`/
 * `previewSplitAmount`. «Мест нет» определяется занятостью события, а не ценой (`seatCount.current`
 * ограничен вместимостью); для отменённого события цена не показывается.
 */
import type { EventPriceQuote } from '@volley-time/shared'

import { priceViewOf, type PriceEventState, type PriceScenario } from './event-price-view'
import { formatMoneyRu } from './labels'

export const SPLIT_SUBSCRIPTION_NOTE = 'Абонемент к событию со сбором суммой не применяется'

export interface PlayerPriceContext {
  /** У игрока активная запись в составе (не лист ожидания). */
  hasBooking: boolean
  /** Доля оплачена (платёж подтверждён организатором). */
  paid?: boolean
}

export interface PlayerSplitScenario extends PriceScenario {
  /** Ширина шкалы «как меняется цена»: текущее наполнение ÷ n мест, в процентах. */
  meterPct: number
}

export interface PlayerSplitView {
  stage: 'open' | 'settled' | 'paid'
  eyebrow: string
  chip: { text: string; tone: 'amber' | 'grass' }
  /** Цена места: «≈ …» до закрытия, точная доля после. */
  headline: string
  /** «от … до …» — только пока границы прогноза различаются. */
  rangeText: string | null
  /** «100,00 BYN ÷ 8 мест». */
  divider: string | null
  scenarios: PlayerSplitScenario[]
  /** Доля игрока за все его места — после закрытия записи («с вас» показывается, пока не оплачено). */
  myTotal: { text: string; seats: number } | null
  full: boolean
  subscriptionNote: string
}

export function playerSplitViewOf(
  quote: EventPriceQuote | null | undefined,
  currency: string,
  event: PriceEventState,
  now: Date | undefined,
  ctx: PlayerPriceContext,
): PlayerSplitView | null {
  if (quote?.mode !== 'split') return null
  const base = priceViewOf(quote, currency, event, now)
  if (!base) return null
  const settled = quote.basis === 'settled'
  const paid = settled && ctx.hasBooking && ctx.paid === true
  const currentSeats = quote.seatCount?.current ?? 0
  return {
    stage: paid ? 'paid' : settled ? 'settled' : 'open',
    eyebrow: settled ? 'Итоговый расчёт' : 'Делим общую сумму',
    chip: paid
      ? { text: 'оплачено', tone: 'grass' }
      : settled
        ? { text: 'зафиксировано', tone: 'grass' }
        : { text: 'предварительно', tone: 'amber' },
    headline: base.headline,
    rangeText: settled ? null : base.rangeText,
    divider: base.divider,
    scenarios: base.scenarios.map((s) => ({
      ...s,
      meterPct: s.seats > 0 ? Math.round((Math.min(currentSeats, s.seats) / s.seats) * 100) : 0,
    })),
    myTotal:
      settled && ctx.hasBooking
        ? { text: formatMoneyRu(quote.total.max, currency), seats: quote.seats }
        : null,
    full: base.full,
    subscriptionNote: SPLIT_SUBSCRIPTION_NOTE,
  }
}

/**
 * Цена split в карточках Главной (hero и расписание): текст и пояснение из ответа цены.
 * `null` — расчёта нет (fixed или цена недоступна): число из другого расчёта подставлять нельзя.
 */
export function quotePriceLabel(
  quote: EventPriceQuote | null | undefined,
  currency: string,
  ctx: Pick<PlayerPriceContext, 'hasBooking'>,
): { text: string; description: string } | null {
  if (quote?.mode !== 'split') return null
  const money = (minor: number) => formatMoneyRu(minor, currency)
  if (quote.basis === 'settled') {
    return ctx.hasBooking
      ? { text: money(quote.total.max), description: 'Ваша доля после закрытия записи' }
      : { text: money(quote.perSeat.max), description: 'Итоговая доля участника' }
  }
  const range =
    quote.perSeat.min !== quote.perSeat.max
      ? `От ${money(quote.perSeat.min)} до ${money(quote.perSeat.max)}. `
      : ''
  return {
    text: `≈ ${money(quote.perSeat.max)}`,
    description: `${range}Точная сумма — когда организатор закроет запись.`,
  }
}
