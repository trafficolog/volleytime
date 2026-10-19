/**
 * Цена split для игрока (20.4.6, M-07): экран события и списки игрока. Все суммы берутся только из
 * ответа `GET …/events/{id}/price` (`quoteEventPrice`, 20.1.1, D-01 (B)), а не из `readEventPricing`/
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
  /** Игрок в листе ожидания: места в составе у него нет. */
  waitlisted?: boolean
}

/** Подпись к прогнозу для игрока без места: цена «если запишетесь» (решение владельца 2026-10-19). */
const ifJoinNote = (ctx: Pick<PlayerPriceContext, 'hasBooking' | 'waitlisted'>) =>
  ctx.hasBooking ? null : ctx.waitlisted ? 'если получите место' : 'если запишетесь'

export interface PlayerSplitScenario extends PriceScenario {
  /** Ширина шкалы «как меняется цена»: занятые места ÷ n мест, в процентах. */
  meterPct: number
}

export interface PlayerSplitView {
  stage: 'open' | 'settled' | 'paid'
  eyebrow: string
  chip: { text: string; tone: 'amber' | 'grass' }
  /** Цена места: «≈ …» до закрытия, точная доля после. */
  headline: string
  /** «если запишетесь» / «если получите место» — прогноз для игрока без места в составе. */
  headlineNote: string | null
  /** «от … до …» — только пока границы прогноза различаются. */
  rangeText: string | null
  /** «100,00 BYN ÷ 8 мест» (без места в составе: «÷ 9 мест с вами»). */
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
  const note = settled ? null : ifJoinNote(ctx)
  return {
    stage: paid ? 'paid' : settled ? 'settled' : 'open',
    eyebrow: settled ? 'Итоговый расчёт' : 'Делим общую сумму',
    chip: paid
      ? { text: 'оплачено', tone: 'grass' }
      : settled
        ? { text: 'зафиксировано', tone: 'grass' }
        : { text: 'предварительно', tone: 'amber' },
    headline: base.headline,
    headlineNote: note,
    rangeText: settled ? null : base.rangeText,
    divider: base.divider && note ? `${base.divider} с вами` : base.divider,
    scenarios: base.scenarios.map((s) => ({
      ...s,
      // шкала считает занятые места события (без «меня», если я ещё не записан)
      meterPct: s.seats > 0 ? Math.round((Math.min(event.taken, s.seats) / s.seats) * 100) : 0,
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
 * Цена split в карточках игрока (Главная, события, «Мои записи»): текст и пояснение из ответа цены.
 * `null` — расчёта нет (fixed или цена недоступна): число из другого расчёта подставлять нельзя.
 */
export function quotePriceLabel(
  quote: EventPriceQuote | null | undefined,
  currency: string,
  ctx: Pick<PlayerPriceContext, 'hasBooking' | 'waitlisted'>,
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
  const note = ifJoinNote(ctx)
  return {
    text: `≈ ${money(quote.perSeat.max)}${note ? `, ${note}` : ''}`,
    description: `${range}Точная сумма — когда организатор закроет запись.`,
  }
}
