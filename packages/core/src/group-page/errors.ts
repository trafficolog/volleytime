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

/** Страница скрыта root, не опубликована или неизвестна — тот же 404 (24.1.3). */
export class GroupPageNotFoundError extends GroupPageError {
  constructor() {
    super('group_page.not_found', 'Group page not found')
  }
}

/** Пока действует решение root, владелец не меняет `seoIndex` (409, 24.1.3). */
export class GroupPageModerationLockedError extends GroupPageError {
  constructor() {
    super(
      'group_page.moderation_locked',
      'Пока действует решение администрации, переключатель не работает',
    )
  }
}

/** Недопустимый переход (409): то же состояние, noindex поверх noindex владельца, нечего вернуть. */
export class GroupPageModerationConflictError extends GroupPageError {
  constructor(
    code:
      'group_page.moderation_same_state' | 'group_page.owner_noindex' | 'group_page.not_moderated',
    message: string,
  ) {
    super(code, message)
  }
}

export class GroupPageComplaintNotFoundError extends GroupPageError {
  constructor(id: number) {
    super('group_page.complaint_not_found', `Complaint ${id} not found`)
  }
}

/** Жалоба уже решена или отклонена (409). */
export class GroupPageComplaintClosedError extends GroupPageError {
  constructor() {
    super('group_page.complaint_closed', 'Complaint is already closed')
  }
}

/** Больше 3 жалоб за сутки с устройства (429). */
export class GroupPageComplaintLimitError extends GroupPageError {
  constructor() {
    super('group_page.complaint_limited', 'Не больше 3 жалоб в сутки')
  }
}
