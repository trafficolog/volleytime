export class VenueError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'VenueError'
  }
}
export class VenueNotFoundError extends VenueError {
  constructor(id: number) {
    super('venue.not_found', `Venue ${id} not found`)
  }
}
