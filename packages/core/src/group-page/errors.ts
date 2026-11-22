export class GroupPageError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'GroupPageError'
  }
}

/** Секция «Зал» ссылается на зал не этой группы, архивный или удалённый (422). */
export class GroupPageVenueInvalidError extends GroupPageError {
  constructor(venueIds: number[]) {
    super(
      'group_page.venue_invalid',
      `Venues are not active venues of the group: ${venueIds.join(', ')}`,
    )
  }
}
