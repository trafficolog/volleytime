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
export class EventCapacityBelowTakenError extends EventError {
  constructor(taken: number) {
    super('event.capacity_below_taken', `Capacity cannot be lower than taken spots (${taken})`)
  }
}
