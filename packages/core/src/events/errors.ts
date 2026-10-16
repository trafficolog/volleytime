export class EventError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'EventError'
  }
}
export class EventNotFoundError extends EventError {
  constructor(id: number) {
    super('event.not_found', `Event ${id} not found`)
  }
}
export class EventNotEditableError extends EventError {
  constructor() {
    super('event.not_editable', 'Cancelled or finished events cannot be edited')
  }
}
/** Режим `invite` выключен до выкладки полного релиза (EVENT_INVITE_MODE_ENABLED, 20.1.3). */
export class EventInviteModeDisabledError extends EventError {
  constructor() {
    super('event.invite_mode_disabled', 'Invite-only booking is not enabled')
  }
}
/** Приглашения и запросы приглашения имеют смысл только у события `invite` (20.1.3). */
export class EventJoinModeOpenError extends EventError {
  constructor() {
    super('event.join_mode_open', 'Event is open for booking without an invite')
  }
}
export class VenueNotInOrgError extends EventError {
  constructor() {
    super('event.venue_not_in_org', 'Venue does not belong to this organization')
  }
}
export class EventStartsInPastError extends EventError {
  constructor() {
    super('event.starts_in_past', 'Event must start in the future')
  }
}
/** Время открытия записи — новая семантика за флагом планировщика (SCHEDULER_ENABLED, 20.3.1). */
export class EventSchedulerDisabledError extends EventError {
  constructor() {
    super('event.scheduler_disabled', 'Scheduled booking opening is not enabled')
  }
}
/** Время открытия записи — в будущем и раньше начала события (20.3.1, D-09). */
export class EventBookingOpensInPastError extends EventError {
  constructor() {
    super('event.booking_opens_in_past', 'Booking opening time must be in the future')
  }
}
/** Запись открывается не позже момента закрытия (начало − `close_before_minutes`). */
export class EventBookingOpensAfterCloseError extends EventError {
  constructor() {
    super(
      'event.booking_opens_after_close',
      'Booking must open no later than it closes before the start',
    )
  }
}
/** Перенос начала или смена срока закрытия перевели бы момент закрытия записи в прошлое (20.3.1). */
export class EventCloseMomentInPastError extends EventError {
  constructor() {
    super('event.close_moment_in_past', 'The booking close moment would already be in the past')
  }
}
export class EventCapacityBelowTakenError extends EventError {
  constructor(taken: number) {
    super('event.capacity_below_taken', `Capacity cannot be lower than taken spots (${taken})`)
  }
}
