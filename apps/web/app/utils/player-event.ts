import type { EventPricingView } from '@volley-time/shared'

import { splitBookingPaymentLabel } from './event-pricing-label'
import { isDeniedOrgError } from './player-home'

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

/** Доступ к странице важнее ожидаемого 403 деталей, но не маскирует сбой загрузки группы. */
export function playerEventPageState(
  access: string,
  sources: Parameters<typeof playerEventReady>[0],
  organizationErrorCode?: string,
) {
  if (sources.organizationPending) return 'loading'
  if (sources.organizationError) {
    if (access === 'suspended' && organizationErrorCode === 'organization.suspended')
      return 'suspended'
    if (access === 'denied' && isDeniedOrgError(organizationErrorCode)) return 'denied'
    return 'error'
  }
  if (access === 'pending' || access === 'suspended' || access === 'denied') return access
  if (sources.eventError) return 'error'
  return playerEventReady(sources) ? 'ready' : 'loading'
}

export function playerEventLoadErrorNotice(status: number | undefined, rejectionMessage: string) {
  if (status === 404) {
    return {
      message: rejectionMessage
        ? `${rejectionMessage}. Событие больше недоступно.`
        : 'Событие больше недоступно.',
      retry: false,
      eventsLink: true,
    }
  }
  return {
    message: rejectionMessage || 'Не удалось открыть событие',
    retry: true,
    eventsLink: false,
  }
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
    pricing?: EventPricingView
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
  const split = event.pricing?.mode === 'split'
  const paymentMethods: ('free' | 'cash' | 'transfer' | 'subscription')[] =
    action === 'none' ? [] : !split && event.price === 0 ? ['free'] : ['cash', 'transfer']
  if (
    !split &&
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
    !(split && event.pricing?.myAllocatedAmount !== null) &&
    !started &&
    ['confirmed', 'pending_payment', 'waitlisted'].includes(bookingStatus ?? '') &&
    (deadline === null || now <= deadline)

  const bookingCard = bookingStatus ? (BOOKING_CARDS[bookingStatus] ?? null) : null
  const splitPayment =
    event.pricing && bookingStatus ? splitBookingPaymentLabel(event.pricing, bookingStatus) : null
  return {
    action,
    paymentMethods,
    bookingStatus,
    bookingCard:
      bookingCard && splitPayment
        ? {
            ...bookingCard,
            ...(bookingStatus === 'pending_payment' && event.pricing?.myAllocatedAmount === null
              ? { title: 'Место забронировано' }
              : {}),
            text: splitPayment.description,
          }
        : bookingCard,
    hasBooking,
    canCancel,
  }
}
