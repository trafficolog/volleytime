import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeTestBot, messageUpdate, myChatMemberUpdate } from '../test-bot'
import { callWeb, markUserReachable } from '../web-client'

import { registerGamesHandler } from './games'
import { registerHelpHandler } from './help'
import { registerMenuHandler } from './menu'
import { registerMyChatMemberHandler } from './my-chat-member'
import { registerMyHandler } from './my'
import { registerStartHandler } from './start'

vi.mock('../web-client', () => ({ callWeb: vi.fn(), markUserReachable: vi.fn() }))
const web = vi.mocked(callWeb)
const reachable = vi.mocked(markUserReachable)

function setup() {
  const t = makeTestBot()
  registerStartHandler(t.bot)
  registerHelpHandler(t.bot)
  registerGamesHandler(t.bot)
  registerMyHandler(t.bot)
  registerMenuHandler(t.bot)
  registerMyChatMemberHandler(t.bot)
  return t
}
const sent = (calls: { method: string; payload: Record<string, unknown> }[]) =>
  calls.filter((c) => c.method === 'sendMessage').map((c) => c.payload)

const game = {
  eventId: 5,
  title: '<b>Основа</b> & Co',
  startsAt: '2026-10-28T17:00:00.000Z',
  timeZone: 'Europe/Minsk',
  organizationName: 'VolleyTime Минск',
  venueName: 'Школа №24',
  capacity: 14,
  taken: 12,
}

describe('/games, /my, menu (20.3.3)', () => {
  beforeEach(() => {
    web.mockReset()
    reachable.mockReset()
  })

  it('/games lists events with escaped titles, occupancy mark, Minsk time and a startapp button', async () => {
    web.mockResolvedValue({ games: [game] })
    const { bot, calls } = setup()
    await bot.handleUpdate(messageUpdate('/games'))
    expect(web).toHaveBeenCalledWith('games', { query: { telegramId: '42' } })
    const msg = sent(calls)[0]!
    expect(msg.parse_mode).toBe('HTML')
    expect(msg.text).toContain('&lt;b&gt;Основа&lt;/b&gt; &amp; Co')
    expect(msg.text).not.toContain('<b>Основа</b>')
    expect(msg.text).toContain('🟡')
    expect(msg.text).toContain('20:00')
    expect(msg.text).toContain('занято 12 из 14')
    const btn = (msg.reply_markup as { inline_keyboard: Record<string, unknown>[][] })
      .inline_keyboard[0]![0]!
    expect(btn.web_app).toEqual({ url: expect.stringContaining('/m/?startapp=event_5') })
  })

  it('/games with no events and with web down', async () => {
    const { bot, calls } = setup()
    web.mockResolvedValueOnce({ games: [] })
    await bot.handleUpdate(messageUpdate('/games'))
    expect(sent(calls)[0]!.text).toContain('нет')
    web.mockResolvedValueOnce(null)
    await bot.handleUpdate(messageUpdate('/games'))
    expect(sent(calls)[1]!.text).toContain('недоступен')
  })

  it('/my shows bookings with status and a cancel callback for active ones only', async () => {
    web.mockResolvedValue({
      bookings: [
        { ...game, bookingId: 1, status: 'confirmed', seats: 2 },
        { ...game, eventId: 6, bookingId: 2, status: 'attended', seats: 1 },
      ],
    })
    const { bot, calls } = setup()
    await bot.handleUpdate(messageUpdate('/my'))
    const msg = sent(calls)[0]!
    expect(msg.text).toContain('вы в составе')
    expect(msg.text).toContain('мест: 2')
    const rows = (msg.reply_markup as { inline_keyboard: Record<string, unknown>[][] })
      .inline_keyboard
    expect(rows[0]!.map((b) => b.callback_data ?? 'link')).toEqual(['link', 'cx:5'])
    expect(rows[1]!.map((b) => b.callback_data ?? 'link')).toEqual(['link'])
  })

  it('reply-keyboard buttons run the same commands, only in private chats', async () => {
    web.mockResolvedValue({ games: [] })
    const { bot } = setup()
    await bot.handleUpdate(messageUpdate('Расписание'))
    expect(web).toHaveBeenCalledTimes(1)
    await bot.handleUpdate(messageUpdate('Расписание', { chatType: 'supergroup' }))
    expect(web).toHaveBeenCalledTimes(1)
  })

  it('/menu sends a persistent reply keyboard', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(messageUpdate('/menu'))
    const kb = sent(calls)[0]!.reply_markup as { keyboard: { text: string }[][] }
    expect(kb.keyboard.flat().map((b) => b.text)).toEqual(['Расписание', 'Мои записи', 'Помощь'])
  })

  it('/start clears the unreachable mark and sends the menu', async () => {
    const { bot, calls } = setup()
    await bot.handleUpdate(messageUpdate('/start'))
    expect(reachable).toHaveBeenCalledWith(42)
    expect(sent(calls)).toHaveLength(2)
  })

  it('my_chat_member -> member clears the mark; kicked and groups do not', async () => {
    const { bot } = setup()
    await bot.handleUpdate(myChatMemberUpdate('member'))
    expect(reachable).toHaveBeenCalledTimes(1)
    await bot.handleUpdate(myChatMemberUpdate('kicked'))
    await bot.handleUpdate(myChatMemberUpdate('member', { chatType: 'supergroup' }))
    expect(reachable).toHaveBeenCalledTimes(1)
  })
})
