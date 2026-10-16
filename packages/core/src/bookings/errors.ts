export class BookingError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'BookingError'
  }
}
export class AlreadyBookedError extends BookingError {
  constructor() {
    super('booking.already_booked', 'You are already booked for this event')
  }
}
export class EventNotBookableError extends BookingError {
  constructor(reason: string) {
    super('booking.event_not_bookable', `Event is not bookable: ${reason}`)
  }
}
export class BookingNotFoundError extends BookingError {
  constructor(id: number | string) {
    super('booking.not_found', `Booking ${id} not found`)
  }
}
export class BookingDeadlinePassedError extends BookingError {
  constructor() {
    super('booking.deadline_passed', 'Cancellation deadline has passed')
  }
}
export class CannotCancelOthersError extends BookingError {
  constructor() {
    super('booking.cannot_cancel_others', 'Cannot cancel another user booking')
  }
}
export class AttendanceTooEarlyError extends BookingError {
  constructor() {
    super('booking.attendance_too_early', 'Attendance can be marked only after the event starts')
  }
}
export class BookingMethodNotAllowedError extends BookingError {
  constructor(method: string) {
    super('booking.method_not_allowed', `Method "${method}" is not allowed for this event`)
  }
}
export class BookingCancellationNotAllowedError extends BookingError {
  constructor() {
    super(
      'booking.cancellation_not_allowed',
      'The group does not allow players to cancel their own bookings',
    )
  }
}
export class BookingNotCancellableError extends BookingError {
  constructor(reason: string) {
    super('booking.not_cancellable', `Booking cannot be cancelled: ${reason}`)
  }
}
export class SeatsOverLimitError extends BookingError {
  constructor() {
    super('booking.seats_over_limit', 'Seats exceed the group limit or the event capacity')
  }
}
export class BookingNotEnoughSeatsError extends BookingError {
  freeSeats: number
  constructor(freeSeats: number) {
    super('booking.not_enough_seats', `Not enough free seats (${freeSeats} left)`)
    this.freeSeats = freeSeats
  }
}
/** Событие `invite`: нет валидного приглашения (20.1.3). Причина не раскрывается. */
export class BookingInviteRequiredError extends BookingError {
  constructor() {
    super('booking.invite_required', 'This event requires a valid invite')
  }
}
export class MultiSeatDisabledError extends BookingError {
  constructor() {
    super('booking.multi_seat_disabled', 'Booking several seats is not enabled')
  }
}
/** Время открытия записи ещё не наступило (20.3.1, D-09). */
export class BookingNotOpenYetError extends BookingError {
  constructor() {
    super('booking.not_open_yet', 'Booking for this event is not open yet')
  }
}
/** Предложения нет или оно чужое: 404 не раскрывает существование (20.3.1). */
export class WaitlistOfferNotFoundError extends BookingError {
  constructor() {
    super('waitlist_offer.not_found', 'Waitlist offer not found')
  }
}
/** Предложение места истекло или снято (20.3.1, D-03). */
export class WaitlistOfferExpiredError extends BookingError {
  constructor() {
    super('waitlist_offer.expired', 'Waitlist offer has expired')
  }
}
