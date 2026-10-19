import type { Bot } from 'grammy'

import type { BotContext } from '../context'
import { markUserReachable } from '../web-client'

/**
 * Пользователь (заново) разрешил писать боту — `my_chat_member` в личном чате со статусом `member`
 * (разблокировка, 20.3.3): снять `users.bot_blocked_at`. Блокировку (`kicked`) не фиксируем:
 * её определяет доставка (20.3.2).
 */
export function registerMyChatMemberHandler(bot: Bot<BotContext>): void {
  bot.on('my_chat_member', async (ctx) => {
    const u = ctx.myChatMember
    if (u.chat.type === 'private' && u.new_chat_member.status === 'member')
      await markUserReachable(u.from.id)
  })
}
