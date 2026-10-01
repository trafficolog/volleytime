const MAX_AMOUNT = 2147483647

function assertTarget(amount: number): void {
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    throw new RangeError('Split target must be a positive PostgreSQL integer')
  }
}

export function allocateSplitAmount(
  totalAmount: number,
  participants: readonly { bookingId: number; bookedAt: Date }[],
): { bookingId: number; amount: number }[] {
  assertTarget(totalAmount)
  if (participants.length === 0 || totalAmount < participants.length) {
    throw new RangeError('Split target must cover at least one cent per participant')
  }
  const quotient = Math.floor(totalAmount / participants.length)
  const remainder = totalAmount % participants.length
  return [...participants]
    .sort((a, b) => a.bookedAt.getTime() - b.bookedAt.getTime() || a.bookingId - b.bookingId)
    .map((p, index) => ({ bookingId: p.bookingId, amount: quotient + (index < remainder ? 1 : 0) }))
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
