import { GrammyError } from 'grammy'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { callbackUpdate, makeTestBot, type ApiCall } from '../test-bot'
import { callWeb } from '../web-client'

import {
  CALLBACK_RE,
  CANCEL_DENIED,
  CANCEL_DONE,
  CANCEL_QUESTION,
  NOT_FOUND,
  OFFER_DONE,
  OFFER_CLOSED,
  OFFER_EXPIRED,
  registerCallbackHandler,
  resetCallbackLimiter,
} from './callbacks'

vi.mock('../web-client', () => ({ callWeb: vi.fn(), markUserReachable: vi.fn() }))
const web = vi.mocked(callWeb)

function setup(opts?: Parameters<typeof makeTestBot>[0]) {
  const t = makeTestBot(opts)
  registerCallbackHandler(t.bot)
  return t
}
const of = (calls: ApiCall[], m: string) => calls.filter((c) => c.method === m)
const rowsOf = (call: { payload: Record<string, unknown> }) =>
  (call.payload.reply_markup as { inline_keyboard: Record<string, unknown>[][] }).inline_keyboard

describe('callback_data validation', () => {
  it('accepts only known actions with numeric id and fits the 64-byte limit', () => {
    for (const ok of ['cx:5', 'cy:12', 'cn:1', 'oa:2147483647', 'rs:5'])
      expect(CALLBACK_RE.test(ok)).toBe(true)
    for (const bad of ['cx:', 'cx:-1', 'cx:5;drop', 'zz:5', 'cx:5 ', 'CX:5', 'cx:12345678901'])
      expect(CALLBACK_RE.test(bad)).toBe(false)
    expect(Buffer.byteLength('oa:2147483647')).toBeLessThanOrEqual(64)
  })
})

describe('inline callbacks (20.3.3)', () => {
  beforeEach(() => {
    web.mockReset()
    resetCallbackLimiter()
  })

  it('«Не смогу» asks for confirmation via editMessageText, keeps formatting and the link row', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate('cx:5'))
    expect(of(calls, 'answerCallbackQuery')).toHaveLength(1)
    const edit = of(calls, 'editMessageText')[0]!
    expect(edit.payload.text).toBe(`Напоминание: завтра Основа\n\n${CANCEL_QUESTION}`)
    expect(edit.payload.entities).toEqual([{ type: 'bold', offset: 0, length: 11 }])
    const rows = rowsOf(edit)
    expect(rows[0]![0]).toMatchObject({ web_app: { url: expect.stringContaining('event_5') } })
    expect(rows[1]!.map((b) => b.callback_data)).toEqual(['cy:5', 'cn:5'])
    expect(web).not.toHaveBeenCalled()
  })

  it('«Нет» restores the message and the cancel button', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(
      callbackUpdate('cn:5', {
        text: `Напоминание: завтра Основа\n\n${CANCEL_QUESTION}`,
        rows: [
          [{ text: 'Открыть', web_app: { url: 'https://vt.test/m/' } }],
          [
            { text: 'Да, отменить', callback_data: 'cy:5' },
            { text: 'Нет', callback_data: 'cn:5' },
          ],
        ],
      }),
    )
    const edit = of(calls, 'editMessageText')[0]!
    expect(edit.payload.text).toBe('Напоминание: завтра Основа')
    expect(rowsOf(edit)[1]![0]).toMatchObject({ callback_data: 'cx:5' })
  })

  it('confirmed cancel calls web with the clicker telegram id and edits the message', async () => {
    web.mockResolvedValue({ result: 'cancelled' })
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate('cy:5', { text: `Напоминание\n\n${CANCEL_QUESTION}` }))
    expect(web).toHaveBeenCalledWith('cancel-booking', {
      method: 'POST',
      body: { telegramId: '42', eventId: 5 },
    })
    const edit = of(calls, 'editMessageText')[0]!
    expect(edit.payload.text).toBe(`Напоминание\n\n${CANCEL_DONE}`)
    // без callback-кнопок: остаётся только ссылка «Открыть»
    expect(rowsOf(edit)).toHaveLength(1)
  })

  it('repeated click on a stale button is idempotent: no second edit, still answered', async () => {
    web.mockResolvedValue({ result: 'already_cancelled' })
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate('cy:5', { text: `Напоминание\n\n${CANCEL_DONE}` }))
    expect(of(calls, 'editMessageText')).toHaveLength(0)
    expect(of(calls, 'answerCallbackQuery')).toHaveLength(1)
  })

  it('swallows «message is not modified» from Telegram', async () => {
    web.mockResolvedValue({ result: 'cancelled' })
    const { bot, calls } = setup({
      failEdit: (c) =>
        c.method === 'editMessageText'
          ? new GrammyError(
              'x',
              { ok: false, error_code: 400, description: 'Bad Request: message is not modified' },
              'editMessageText',
              {},
            )
          : null,
    })
    await expect(bot.handleUpdate(callbackUpdate('cy:5'))).resolves.toBeUndefined()
    expect(of(calls, 'answerCallbackQuery')).toHaveLength(1)
  })

  it.each([
    ['not_allowed', CANCEL_DENIED],
    ['not_found', NOT_FOUND],
  ])('cancel outcome %s is shown to the player', async (result, line) => {
    web.mockResolvedValue({ result })
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate('cy:5'))
    expect(String(of(calls, 'editMessageText')[0]!.payload.text)).toContain(line)
  })

  it('web unavailable: toast only, message untouched', async () => {
    web.mockResolvedValue(null)
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate('cy:5'))
    expect(of(calls, 'editMessageText')).toHaveLength(0)
    expect(String(of(calls, 'answerCallbackQuery')[0]!.payload.text)).toContain('недоступен')
  })

  it.each([
    ['accepted', OFFER_DONE],
    ['expired', OFFER_EXPIRED],
    ['closed', OFFER_CLOSED],
  ])('«Беру место» outcome %s', async (result, line) => {
    web.mockResolvedValue({ result })
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate('oa:5'))
    expect(web).toHaveBeenCalledWith('accept-offer', {
      method: 'POST',
      body: { telegramId: '42', eventId: 5 },
    })
    expect(String(of(calls, 'editMessageText')[0]!.payload.text)).toContain(line)
  })

  it.each([
    ['malformed data', 'cy:5;drop', {}],
    ['unknown action', 'zz:5', {}],
    ['group chat', 'cy:5', { chatType: 'supergroup', chatId: -100 }],
    ['chat of another user', 'cy:5', { chatId: 999 }],
  ])('%s is rejected without calling web', async (_n, data, opts) => {
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate(data, opts))
    expect(web).not.toHaveBeenCalled()
    expect(of(calls, 'editMessageText')).toHaveLength(0)
    expect(of(calls, 'answerCallbackQuery')).toHaveLength(1)
  })

  it('rate limits callback floods per user', async () => {
    web.mockResolvedValue({ result: 'cancelled' })
    const { bot } = setup()
    for (let i = 0; i < 12; i++) await bot.handleUpdate(callbackUpdate('cy:5'))
    expect(web.mock.calls.length).toBe(8)
  })
})

describe('«Кто уже играет» (21.4.9)', () => {
  const START_TEXT = 'Привет, Артём!\n\nТебя приглашают на событие.'
  const startRows = [
    [{ text: 'Открыть', web_app: { url: 'https://vt.test/m/?startapp=event_5' } }],
    [{ text: '👥 Кто уже играет', callback_data: 'rs:5' }],
  ]
  const roster = {
    result: 'ok',
    title: 'Основа',
    startsAt: '2026-10-28T17:00:00.000Z',
    timeZone: 'Europe/Minsk',
    capacity: 6,
    players: [
      { name: 'Анна', seats: 1 },
      { name: null, seats: 2 },
    ],
  }
  beforeEach(() => {
    web.mockReset()
    resetCallbackLimiter()
  })

  it('appends names and seats to the message, keeps all buttons and calls web with the clicker id', async () => {
    web.mockResolvedValue(roster)
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate('rs:5', { text: START_TEXT, rows: startRows }))
    expect(web).toHaveBeenCalledWith('event-roster', {
      method: 'POST',
      body: { telegramId: '42', eventId: 5 },
    })
    const edit = of(calls, 'editMessageText')[0]!
    expect(edit.payload.text).toBe(
      `${START_TEXT}\n\n👥 Состав события: занято 3 из 6\n1. Анна\n2. Игрок +1`,
    )
    expect(rowsOf(edit)).toEqual(startRows)
  })

  it('a repeated press refreshes the block instead of duplicating it', async () => {
    web.mockResolvedValue(roster)
    const { bot, calls } = setup()
    const first = `${START_TEXT}\n\n👥 Состав события: занято 1 из 6\n1. Анна`
    await bot.handleUpdate(callbackUpdate('rs:5', { text: first, rows: startRows }))
    const text = String(of(calls, 'editMessageText')[0]!.payload.text)
    expect(text.match(/Состав события:/g)).toHaveLength(1)
    expect(text.startsWith(START_TEXT)).toBe(true)
  })

  it('keeps the edited text within the 4096-character Telegram limit', async () => {
    web.mockResolvedValue({
      ...roster,
      players: Array.from({ length: 100 }, (_, i) => ({ name: `Игрок ${i}`.repeat(30), seats: 1 })),
    })
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate('rs:5', { text: START_TEXT, rows: startRows }))
    expect(String(of(calls, 'editMessageText')[0]!.payload.text).length).toBeLessThanOrEqual(4096)
  })

  it('not a member / foreign event: toast only, the message is not edited', async () => {
    web.mockResolvedValue({ result: 'not_found' })
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate('rs:5', { text: START_TEXT, rows: startRows }))
    expect(of(calls, 'editMessageText')).toHaveLength(0)
    expect(String(of(calls, 'answerCallbackQuery')[0]!.payload.text)).toContain('участникам группы')
  })

  it('web unavailable: toast only', async () => {
    web.mockResolvedValue(null)
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate('rs:5', { text: START_TEXT, rows: startRows }))
    expect(of(calls, 'editMessageText')).toHaveLength(0)
    expect(String(of(calls, 'answerCallbackQuery')[0]!.payload.text)).toContain('недоступен')
  })

  it('ignores presses outside the private chat with the user', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(callbackUpdate('rs:5', { chatId: -100500, chatType: 'supergroup' }))
    expect(web).not.toHaveBeenCalled()
    expect(of(calls, 'editMessageText')).toHaveLength(0)
  })
})
