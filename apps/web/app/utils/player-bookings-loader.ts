type Filter = 'upcoming' | 'past'

export function createPlayerBookingsLoader<T>(
  getOrganizationId: () => number,
  getFilter: () => Filter,
  fetchBookings: (organizationId: number, filter: Filter) => Promise<T[]>,
) {
  let latest = 0
  return async (): Promise<{ stale: true } | { stale: false; bookings: T[] }> => {
    const organizationId = getOrganizationId()
    const filter = getFilter()
    const request = ++latest
    const current = () =>
      request === latest && organizationId === getOrganizationId() && filter === getFilter()
    try {
      const bookings = await fetchBookings(organizationId, filter)
      return current() ? { stale: false, bookings } : { stale: true }
    } catch (error) {
      if (!current()) return { stale: true }
      throw error
    }
  }
}

type CancellableBooking = {
  id: number
  status: string
  startsAt: string | Date
  cancellationDeadlineHours: number | null
}

export function canCancelPlayerBooking(booking: CancellableBooking, now: Date) {
  const start = new Date(booking.startsAt)
  const deadline =
    booking.cancellationDeadlineHours === null
      ? null
      : new Date(start.getTime() - booking.cancellationDeadlineHours * 3600_000)
  return (
    ['confirmed', 'pending_payment', 'waitlisted'].includes(booking.status) &&
    start > now &&
    (deadline === null || now <= deadline)
  )
}

export async function runPlayerBookingCancellation(
  booking: CancellableBooking,
  now: Date,
  submit: (bookingId: number) => Promise<unknown>,
  isCurrent: () => boolean,
  onSuccess: () => void | Promise<void>,
): Promise<{ kind: 'blocked' | 'stale' | 'success' } | { kind: 'error'; error: unknown }> {
  if (!canCancelPlayerBooking(booking, now)) return { kind: 'blocked' }
  try {
    await submit(booking.id)
    if (!isCurrent()) return { kind: 'stale' }
    await onSuccess()
    return isCurrent() ? { kind: 'success' } : { kind: 'stale' }
  } catch (error) {
    return isCurrent() ? { kind: 'error', error } : { kind: 'stale' }
  }
}
