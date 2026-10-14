/**
 * Единый расчёт цены места (20.1.1, P-03). Чистая функция: деньги — целые минимальные единицы,
 * без плавающей точки; округления до 0,1 Br нет (D-01) — split делится до копейки, как R0.7.
 */

const MAX_AMOUNT = 2147483647
const MAX_CAPACITY = 500

export interface PriceRange {
  min: number
  max: number
}

export interface EventPriceQuote {
  mode: 'fixed' | 'split'
  /** fixed — цена события; forecast — прогноз split до закрытия; settled — split зафиксирован. */
  basis: 'fixed' | 'forecast' | 'settled'
  seats: number
  /** Цена одного места: «от min до max». */
  perSeat: PriceRange
  /** Сумма за все `seats` мест игрока. */
  total: PriceRange
  /** split: число мест, на которое делится сумма — сейчас (с местами игрока) и максимум. */
  seatCount: { current: number; max: number } | null
  targetAmount: number | null
  /** Абонемент применим только к платному fixed в группе с включёнными абонементами (P-03). */
  subscriptionApplicable: boolean
}

export type EventPriceQuoteInput =
  | { mode: 'fixed'; price: number; seats: number; subscriptionsEnabled: boolean }
  | {
      mode: 'split'
      targetAmount: number
      capacity: number
      /** Занятые места активных записей события (включая места игрока). */
      takenSeats: number
      /** Места, которые уже держит активная запись игрока (0 — не записан). */
      mySeats: number
      /** Места, для которых считается цена. */
      seats: number
      /** Снимок фиксации; null — запись ещё не закрыта. */
      settled: { participantCount: number; myAllocatedAmount: number | null } | null
    }

const isCount = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max

function assertAmount(amount: number, min: number, label: string): void {
  if (!isCount(amount, min, MAX_AMOUNT))
    throw new RangeError(`${label} must be an integer in minor units within PostgreSQL integer`)
}

function assertSeats(seats: number): void {
  if (!Number.isInteger(seats) || seats < 1)
    throw new RangeError('Seats must be a positive integer')
}

/** Доли N единиц-мест при делении `target` на `units` мест (точное распределение копеек D-01). */
function unitsShare(target: number, units: number, seats: number): PriceRange {
  const quotient = Math.floor(target / units)
  return { min: seats * quotient, max: seats * quotient + Math.min(seats, target % units) }
}

const ceilDiv = (a: number, b: number) => Math.floor(a / b) + (a % b === 0 ? 0 : 1)

export function quoteEventPrice(input: EventPriceQuoteInput): EventPriceQuote {
  assertSeats(input.seats)
  const seats = input.seats

  if (input.mode === 'fixed') {
    assertAmount(input.price, 0, 'Price')
    const total = input.price * seats
    return {
      mode: 'fixed',
      basis: 'fixed',
      seats,
      perSeat: { min: input.price, max: input.price },
      total: { min: total, max: total },
      seatCount: null,
      targetAmount: null,
      subscriptionApplicable: input.subscriptionsEnabled && input.price > 0,
    }
  }

  const { targetAmount: target, capacity, takenSeats, mySeats } = input
  assertAmount(target, 1, 'Split target')
  if (
    !isCount(capacity, 1, MAX_CAPACITY) ||
    !isCount(takenSeats, 0, capacity) ||
    !isCount(mySeats, 0, takenSeats) ||
    seats > capacity
  )
    throw new RangeError('Invalid split seat counts')
  const common = {
    mode: 'split' as const,
    seats,
    targetAmount: target,
    subscriptionApplicable: false,
  }

  if (input.settled) {
    const { participantCount, myAllocatedAmount } = input.settled
    if (!isCount(participantCount, 1, MAX_CAPACITY))
      throw new RangeError('Invalid settled participant count')
    const ownShare =
      myAllocatedAmount !== null && seats === mySeats
        ? { min: myAllocatedAmount, max: myAllocatedAmount }
        : null
    return {
      ...common,
      basis: 'settled',
      perSeat: ownShare
        ? {
            min: Math.floor(ownShare.min / seats),
            max: ceilDiv(ownShare.max, seats),
          }
        : unitsShare(target, participantCount, 1),
      total: ownShare ?? unitsShare(target, participantCount, seats),
      seatCount: { current: participantCount, max: participantCount },
    }
  }

  // До закрытия: делим на текущие места с местами игрока (верх) и на вместимость (низ).
  const current = Math.min(capacity, takenSeats - mySeats + seats)
  const atCurrent = unitsShare(target, current, seats)
  const atCapacity = unitsShare(target, capacity, seats)
  return {
    ...common,
    basis: 'forecast',
    perSeat: { min: Math.floor(target / capacity), max: ceilDiv(target, current) },
    total: { min: atCapacity.min, max: atCurrent.max },
    seatCount: { current, max: capacity },
  }
}
