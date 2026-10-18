import { GrammyError } from 'grammy'
import { describe, expect, it } from 'vitest'

import { classifySendError } from './internal-server'

describe('internal notify — Bot API failure classification (20.3.2)', () => {
  const failure = (code: number, description: string, parameters = {}) =>
    new GrammyError(
      `Call to 'sendMessage' failed! (${code}: ${description})`,
      { ok: false, error_code: code, description, parameters },
      'sendMessage',
      {},
    )

  it('treats a blocked bot, a deactivated user and a missing chat as unreachable', () => {
    expect(classifySendError(failure(403, 'Forbidden: bot was blocked by the user'))).toEqual({
      kind: 'blocked',
      code: 403,
    })
    expect(classifySendError(failure(403, 'Forbidden: user is deactivated'))).toMatchObject({
      kind: 'blocked',
    })
    expect(classifySendError(failure(400, 'Bad Request: chat not found'))).toMatchObject({
      kind: 'blocked',
    })
  })

  it('reports the rate limit with retry_after', () => {
    expect(classifySendError(failure(429, 'Too Many Requests', { retry_after: 7 }))).toEqual({
      kind: 'rate_limited',
      retryAfter: 7,
    })
    expect(classifySendError(failure(429, 'Too Many Requests'))).toMatchObject({
      retryAfter: 30,
    })
  })

  it('leaves other errors to the generic handler', () => {
    expect(classifySendError(failure(400, 'Bad Request: message is too long'))).toEqual({
      kind: 'other',
    })
    expect(classifySendError(failure(500, 'Internal Server Error'))).toEqual({ kind: 'other' })
    expect(classifySendError(new Error('socket hang up'))).toEqual({ kind: 'other' })
  })
})
