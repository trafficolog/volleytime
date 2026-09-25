export function playerEventReady(sources: {
  eventMatches: boolean
  organizationMatches: boolean
  eventPending: boolean
  organizationPending: boolean
  eventError: boolean
  organizationError: boolean
}) {
  return (
    sources.eventMatches &&
    sources.organizationMatches &&
    !sources.eventPending &&
    !sources.organizationPending &&
    !sources.eventError &&
    !sources.organizationError
  )
}

const BOOKING_CARDS: Record<
  string,
  { tone: 'grass' | 'amber' | 'default'; title: string; text: string }
> = {
  confirmed: {
    tone: 'grass',
    title: 'Вы записаны',
    text: 'Место за вами. До встречи на площадке!',
  },
  attended: {
    tone: 'grass',
    title: 'Вы были на тренировке',
    text: 'Посещение отмечено организатором.',
  },
  no_show: {
    tone: 'default',
    title: 'Отмечено: не пришли',
    text: 'Если это ошибка — напишите организатору.',
  },
  pending_payment: {
    tone: 'amber',
    title: 'Место забронировано — ждёт оплаты',
    text: 'Оплатите организатору наличными или переводом, он подтвердит оплату.',
  },
  waitlisted: {
    tone: 'default',
    title: 'Вы в листе ожидания',
    text: 'Если кто-то отменит запись, место перейдёт к вам — пришлём уведомление.',
  },
  cancelled: {
    tone: 'default',
    title: 'Запись отменена',
    text: 'Если места ещё доступны, можно записаться снова.',
  },
}

export function eventCardBookingState(status: string | null) {
  if (status === 'confirmed' || status === 'attended')
    return { tone: 'grass' as const, text: 'Вы записаны' }
  if (status === 'pending_payment') return { tone: 'amber' as const, text: 'Ждёт оплаты' }
  if (status === 'waitlisted') return { tone: 'default' as const, text: 'В листе ожидания' }
  if (status === 'cancelled') return { tone: 'default' as const, text: 'Запись отменена' }
  return null
}

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

  return {
    action,
    paymentMethods,
    bookingStatus,
    bookingCard: bookingStatus ? (BOOKING_CARDS[bookingStatus] ?? null) : null,
    hasBooking,
    canCancel,
  }
}
