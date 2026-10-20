import { GrammyError } from 'grammy'
import { describe, expect, it } from 'vitest'

import { classifySendError, scrubSendError } from './internal-server'

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

  it('names the reason a group chat became unavailable (20.3.4)', () => {
    expect(
      classifySendError(failure(403, 'Forbidden: bot was kicked from the supergroup chat')),
    ).toEqual({ kind: 'blocked', code: 403, reason: 'bot_removed' })
    expect(
      classifySendError(failure(403, 'Forbidden: bot is not a member of the group chat')),
    ).toMatchObject({ reason: 'bot_removed' })
    expect(classifySendError(failure(403, 'Forbidden: the group chat was deleted'))).toMatchObject({
      reason: 'bot_removed',
    })
    expect(
      classifySendError(failure(400, 'Bad Request: have no rights to send a message')),
    ).toEqual({ kind: 'blocked', code: 400, reason: 'no_rights' })
    expect(
      classifySendError(failure(403, 'Forbidden: not enough rights to send text messages')),
    ).toMatchObject({ reason: 'no_rights' })
    expect(classifySendError(failure(400, 'Bad Request: CHAT_WRITE_FORBIDDEN'))).toMatchObject({
      reason: 'no_rights',
    })
    expect(
      classifySendError(
        failure(400, 'Bad Request: group chat was upgraded to a supergroup chat', {
          migrate_to_chat_id: -1001234567890,
        }),
      ),
    ).toEqual({ kind: 'blocked', code: 400, reason: 'migrated' })
  })

  it('does not invent a reason for a private chat the user blocked', () => {
    expect(
      classifySendError(failure(403, 'Forbidden: bot was blocked by the user')),
    ).not.toHaveProperty('reason')
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

describe('scrubSendError (20.3.4)', () => {
  it('keeps only the Bot API code and description, never the request payload', () => {
    const e = new GrammyError(
      "Call to 'sendMessage' failed! (400: Bad Request: chat not found)",
      { ok: false, error_code: 400, description: 'Bad Request: chat not found', parameters: {} },
      'sendMessage',
      { chat_id: '-1001234567890', text: 'Основа · Школа №24' },
    )
    const scrubbed = scrubSendError(e)
    expect(scrubbed).toEqual({ code: 400, description: 'Bad Request: chat not found' })
    expect(JSON.stringify(scrubbed)).not.toContain('1001234567890')
    expect(JSON.stringify(scrubbed)).not.toContain('Основа')
  })

  it('reduces other errors to their name', () => {
    expect(scrubSendError(new TypeError('connect ECONNREFUSED http://x?token=123:SECRET'))).toEqual(
      {
        description: 'TypeError',
      },
    )
    expect(scrubSendError('boom')).toEqual({ description: 'unknown' })
  })
})
