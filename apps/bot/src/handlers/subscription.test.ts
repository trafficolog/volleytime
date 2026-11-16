import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeTestBot, messageUpdate } from '../test-bot'
import { callWeb } from '../web-client'

import {
  buildSubscriptionsMessage,
  NO_SUBSCRIPTIONS_TEXT,
  registerSubscriptionHandler,
} from './subscription'

vi.mock('../web-client', () => ({ callWeb: vi.fn(), markUserReachable: vi.fn() }))
const web = vi.mocked(callWeb)

const row = {
  organizationId: 3,
  organizationName: 'Минск <A>',
  timeZone: 'Europe/Minsk',
  planName: 'Абонемент 8',
  remaining: 3,
  total: 8,
  expiresAt: '2026-12-31T20:00:00.000Z',
}

describe('«Мой абонемент» (21.4.9)', () => {
  beforeEach(() => web.mockReset())

  it('shows remaining sessions, expiry in the group time zone and a Mini App link, escaped', () => {
    const { text, keyboard } = buildSubscriptionsMessage([
      row,
      { ...row, planName: 'Разовый', remaining: 1, total: 1, expiresAt: null },
    ])
    expect(text).toContain('Минск &lt;A&gt;')
    expect(text).toContain('Осталось 3 занятия из 8 · до 31 декабря 2026')
    expect(text).toContain('Осталось 1 занятие из 1 · бессрочно')
    // одна ссылка на группу, даже если абонементов несколько
    expect(keyboard!.inline_keyboard.filter((r) => r.length)).toHaveLength(1)
    expect(keyboard!.inline_keyboard[0]![0]).toMatchObject({
      web_app: { url: expect.stringMatching(/\/m\/orgs\/3\/subscriptions$/) },
    })
  })

  it('empty list gives the hint without buttons', () => {
    expect(buildSubscriptionsMessage([])).toEqual({ text: NO_SUBSCRIPTIONS_TEXT })
  })

  it('reply-menu text asks web with the sender telegram id in a private chat only', async () => {
    web.mockResolvedValue({ subscriptions: [row] })
    const { bot, calls } = makeTestBot()
    registerSubscriptionHandler(bot)
    await bot.handleUpdate(messageUpdate('Мой абонемент'))
    expect(web).toHaveBeenCalledWith('subscriptions', { query: { telegramId: '42' } })
    expect(calls.filter((c) => c.method === 'sendMessage')).toHaveLength(1)
    await bot.handleUpdate(
      messageUpdate('Мой абонемент', { chatId: -100500, chatType: 'supergroup' }),
    )
    expect(web).toHaveBeenCalledTimes(1)
  })

  it('web unavailable: one «сервис недоступен» reply', async () => {
    web.mockResolvedValue(null)
    const { bot, calls } = makeTestBot()
    registerSubscriptionHandler(bot)
    await bot.handleUpdate(messageUpdate('Мой абонемент'))
    const sent = calls.filter((c) => c.method === 'sendMessage')
    expect(sent).toHaveLength(1)
    expect(String(sent[0]!.payload.text)).toContain('недоступен')
  })
})
