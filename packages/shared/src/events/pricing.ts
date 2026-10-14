const MAX_AMOUNT = 2147483647

function assertTarget(amount: number): void {
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    throw new RangeError('Split target must be a positive PostgreSQL integer')
  }
}

/**
 * Делит сумму split по единицам-местам (20.1.1, D-01): запись на `seats` мест — `seats` единиц
 * подряд в порядке (bookedAt, bookingId); остаток копеек получают первые единицы. Сумма долей
 * равна цели до копейки. Без `seats` каждая запись — одно место, результат как в R0.7.
 */
export function allocateSplitAmount(
  totalAmount: number,
  participants: readonly { bookingId: number; bookedAt: Date; seats?: number }[],
): { bookingId: number; amount: number }[] {
  assertTarget(totalAmount)
  let units = 0
  for (const p of participants) {
    const seats = p.seats ?? 1
    if (!Number.isInteger(seats) || seats < 1)
      throw new RangeError('Seats must be a positive integer')
    units += seats
  }
  if (units === 0 || totalAmount < units) {
    throw new RangeError('Split target must cover at least one cent per participant')
  }
  const quotient = Math.floor(totalAmount / units)
  const remainder = totalAmount % units
  let unit = 0
  return [...participants]
    .sort((a, b) => a.bookedAt.getTime() - b.bookedAt.getTime() || a.bookingId - b.bookingId)
    .map((p) => {
      const seats = p.seats ?? 1
      const extra = Math.max(0, Math.min(unit + seats, remainder) - unit)
      unit += seats
      return { bookingId: p.bookingId, amount: seats * quotient + extra }
    })
}

export function previewSplitAmount(
  targetAmount: number,
  taken: number,
  capacity: number,
): {
  minAmount: number
  maxAmount: number
  participantCount: number
  basis: 'current' | 'capacity'
} {
  assertTarget(targetAmount)
  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 500 ||
    !Number.isInteger(taken) ||
    taken < 0 ||
    taken > capacity
  ) {
    throw new RangeError('Invalid split participant count or capacity')
  }
  const participantCount = taken || capacity
  const minAmount = Math.floor(targetAmount / participantCount)
  return {
    minAmount,
    maxAmount: minAmount + (targetAmount % participantCount === 0 ? 0 : 1),
    participantCount,
    basis: taken === 0 ? 'capacity' : 'current',
  }
}
