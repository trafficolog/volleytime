/** Ошибки серий событий (20.2.2); статусы — `CODE_STATUS` в apps/web/server/utils/handle-errors.ts. */
export class SeriesError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'SeriesError'
  }
}

export class SeriesNotFoundError extends SeriesError {
  constructor(id: number) {
    super('series.not_found', `Series ${id} not found`)
  }
}

export class SeriesInvalidRuleError extends SeriesError {
  constructor(message: string) {
    super('series.invalid_rule', message)
  }
}

export class SeriesTooManyDatesError extends SeriesError {
  constructor(message: string) {
    super('series.too_many_dates', message)
  }
}

/** Тот же ключ идемпотентности с другим содержимым запроса. */
export class SeriesIdempotencyConflictError extends SeriesError {
  constructor() {
    super(
      'series.idempotency_conflict',
      'Idempotency key was already used for a different series request',
    )
  }
}
