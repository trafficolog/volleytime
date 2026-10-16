import { describe, expect, it } from 'vitest'

import { apiErrorMessage } from './api-error'

const apiError = (code: string, statusCode = 409) => ({
  statusCode,
  data: { statusMessage: 'English server text', data: { code } },
})

describe('apiErrorMessage: события и серии (20.5.5)', () => {
  it.each([
    ['event.series_date_locked', 'серию'],
    ['series.from_in_past', 'Прошедшие даты'],
    ['event_balance.insufficient', 'баланса событий'],
    ['series.invalid_rule', 'правило повтора'],
    ['series.too_many_dates', '366'],
    ['series.idempotency_conflict', 'ещё раз'],
  ])('%s has a clear Russian message', (code, part) => {
    const message = apiErrorMessage(apiError(code), 'fallback')
    expect(message).toContain(part)
    expect(message).not.toBe('fallback')
  })
})
