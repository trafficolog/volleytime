import type { EventPricingView } from '@volley-time/shared'

import { myBookingSeatsText, myBookingTitle } from './booking-seats'
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

/**
 * Ось «Оплата» для чипа записи: amber — нужно действие, grass — в порядке.
 * Участие («Иду», «В очереди») и состояние события рисуют `VtMyChip` / `VtStateChip`,
 * поэтому здесь только деньги; `null` — отдельного платёжного чипа нет.
 */
export function bookingPaymentChip(status: string | null, pricing?: EventPricingView) {
  if (!status || status === 'waitlisted') return null
  const split = pricing ? splitBookingPaymentLabel(pricing, status) : null
  if (split) return { tone: split.tone, text: split.text }
  if (status === 'pending_payment') return { tone: 'amber' as const, text: 'Ждёт оплаты' }
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
    /** Свободные места для новой записи с учётом предложений из очереди (сервер, 20.3.1). */
    freeSeats?: number
    /** Время открытия записи (20.3.1): до него запись закрыта для всех. */
    bookingOpensAt?: string | Date | null
    /** Запись закрыта по расписанию — решает сервер (`isBookingClosedBySchedule`, метка ручного закрытия учтена). */
    bookingClosed?: boolean
    /** Срок закрытия записи: только чтобы знать, когда перечитать событие. */
    closeBeforeMinutes?: number
    myBooking: {
      status: string
      seats?: number
      waitlistSeats?: number
      /** Активное предложение места из очереди (D-03). */
      offer?: { id: number; seats: number; expiresAt: string | Date } | null
    } | null
  },
  context: {
    memberActive: boolean
    subscriptionsEnabled: boolean | null
    hasEligibleSubscription: boolean
    /** Планировщик включён (capabilities.eventScheduler): запись закрывается с момента закрытия. */
    schedulerEnabled?: boolean
  },
  now: Date,
) {
  const started = new Date(event.startsAt) <= now
  const bookingStatus = event.myBooking?.status ?? null
  const hasBooking = bookingStatus !== null && bookingStatus !== 'cancelled'
  const opensAt =
    event.bookingOpensAt && new Date(event.bookingOpensAt) > now
      ? new Date(event.bookingOpensAt)
      : null
  const freeSeats = Math.max(0, event.freeSeats ?? event.capacity - event.taken)
  const closeAt =
    event.closeBeforeMinutes === undefined
      ? null
      : new Date(new Date(event.startsAt).getTime() - event.closeBeforeMinutes * 60_000)
  const closedBySchedule = event.bookingClosed === true
  const bookable =
    context.memberActive &&
    event.status === 'published' &&
    !started &&
    !hasBooking &&
    !opensAt &&
    !closedBySchedule
  const action = bookable ? (freeSeats === 0 ? 'waitlist' : 'book') : 'none'
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

  const baseCard = bookingStatus ? (BOOKING_CARDS[bookingStatus] ?? null) : null
  const bookingCard =
    baseCard && event.myBooking
      ? { ...baseCard, title: myBookingTitle(event.myBooking, baseCard.title) }
      : baseCard
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
            ...(bookingStatus === 'pending_payment' &&
            event.pricing?.myAllocatedAmount === null &&
            (event.myBooking?.seats ?? 1) <= 1
              ? { title: 'Место забронировано' }
              : {}),
            text: splitPayment.description,
          }
        : bookingCard,
    hasBooking,
    canCancel,
    freeSeats,
    opensAt,
    closedBySchedule,
    /** Ближайший момент, когда вид изменится сам (открытие / закрытие записи). */
    nextBoundary:
      [
        opensAt,
        closeAt && context.schedulerEnabled && !closedBySchedule && closeAt > now ? closeAt : null,
      ]
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
    seatsNote: event.myBooking && hasBooking ? myBookingSeatsText(event.myBooking) : null,
    offer: hasBooking ? (event.myBooking?.offer ?? null) : null,
  }
}
