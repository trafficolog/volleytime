export function projectPlayerEvent(
  event: {
    status: string
    startsAt: string | Date
    cancellationDeadlineHours: number | null
    capacity: number
    taken: number
    price: number
    myBooking: { status: string } | null
  },
  context: {
    memberActive: boolean
    subscriptionsEnabled: boolean | null
    hasEligibleSubscription: boolean
  },
  now: Date,
) {
  const started = new Date(event.startsAt) <= now
  const bookingStatus = event.myBooking?.status ?? null
  const hasBooking = bookingStatus !== null && bookingStatus !== 'cancelled'
  const bookable = context.memberActive && event.status === 'published' && !started && !hasBooking
  const action = bookable ? (event.taken >= event.capacity ? 'waitlist' : 'book') : 'none'
  const paymentMethods: ('free' | 'cash' | 'transfer' | 'subscription')[] =
    action === 'none' ? [] : event.price === 0 ? ['free'] : ['cash', 'transfer']
  if (
    event.price > 0 &&
    action !== 'none' &&
    context.subscriptionsEnabled === true &&
    context.hasEligibleSubscription
  ) {
    paymentMethods.push('subscription')
  }
  const deadline =
    event.cancellationDeadlineHours == null
      ? null
      : new Date(new Date(event.startsAt).getTime() - event.cancellationDeadlineHours * 3600_000)
  const canCancel =
    context.memberActive &&
    !started &&
    ['confirmed', 'pending_payment', 'waitlisted'].includes(bookingStatus ?? '') &&
    (deadline === null || now <= deadline)

  return { action, paymentMethods, bookingStatus, canCancel }
}
