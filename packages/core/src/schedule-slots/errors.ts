export class ScheduleSlotError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ScheduleSlotError'
  }
}
export class ScheduleSlotNotFoundError extends ScheduleSlotError {
  constructor(id: number) {
    super('schedule_slot.not_found', `Schedule slot ${id} not found`)
  }
}
export class ScheduleSlotLimitError extends ScheduleSlotError {
  constructor(limit: number) {
    super('schedule_slot.limit_reached', `A group can have at most ${limit} schedule slots`)
  }
}
