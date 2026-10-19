import { Bot } from 'grammy'

import type { BotContext } from './context'

export interface ApiCall {
  method: string
  payload: Record<string, unknown>
}

/** Бот для тестов: транспорт перехвачен, в Telegram ничего не уходит (токен фиктивный). */
export function makeTestBot(opts: { failEdit?: (call: ApiCall) => Error | null } = {}): {
  bot: Bot<BotContext>
  calls: ApiCall[]
} {
  const bot = new Bot<BotContext>('123456:TEST_TOKEN', {
    botInfo: {
      id: 1,
      is_bot: true,
      first_name: 'VolleyTime',
      username: 'volleytime_test_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
      can_manage_bots: false,
      supports_join_request_queries: false,
    },
  })
  const calls: ApiCall[] = []
  bot.api.config.use(async (_prev, method, payload) => {
    const call = { method, payload: payload as Record<string, unknown> }
    calls.push(call)
    const err = opts.failEdit?.(call)
    if (err) throw err
    return { ok: true, result: true } as never
  })
  return { bot, calls }
}

const user = (id: number) => ({ id, is_bot: false, first_name: 'Артём' })

export function messageUpdate(text: string, opts: { userId?: number; chatType?: string } = {}) {
  const id = opts.userId ?? 42
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 1,
      chat: { id, type: opts.chatType ?? 'private', first_name: 'Артём' },
      from: user(id),
      text,
      ...(text.startsWith('/')
        ? { entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0]!.length }] }
        : {}),
    },
  } as never
}

export function callbackUpdate(
  data: string,
  opts: {
    userId?: number
    chatId?: number
    chatType?: string
    text?: string
    rows?: unknown[][]
  } = {},
) {
  const id = opts.userId ?? 42
  return {
    update_id: 2,
    callback_query: {
      id: 'cb1',
      from: user(id),
      chat_instance: 'ci',
      data,
      message: {
        message_id: 7,
        date: 1,
        chat: { id: opts.chatId ?? id, type: opts.chatType ?? 'private' },
        from: { id: 1, is_bot: true, first_name: 'VolleyTime' },
        text: opts.text ?? 'Напоминание: завтра Основа',
        entities: [{ type: 'bold', offset: 0, length: 11 }],
        reply_markup: {
          inline_keyboard: opts.rows ?? [
            [{ text: 'Открыть', web_app: { url: 'https://vt.test/m/?startapp=event_5' } }],
            [{ text: 'Не смогу', callback_data: 'cx:5' }],
          ],
        },
      },
    },
  } as never
}

export function myChatMemberUpdate(status: string, opts: { chatType?: string } = {}) {
  return {
    update_id: 3,
    my_chat_member: {
      chat: { id: 42, type: opts.chatType ?? 'private', first_name: 'Артём' },
      from: user(42),
      date: 1,
      old_chat_member: { status: 'kicked', user: { id: 1, is_bot: true, first_name: 'B' } },
      new_chat_member: { status, user: { id: 1, is_bot: true, first_name: 'B' } },
    },
  } as never
}
