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
export class BookingNotCancellableError extends BookingError {
  constructor(reason: string) {
    super('booking.not_cancellable', `Booking cannot be cancelled: ${reason}`)
  }
}
