import type { Bot } from 'grammy'

import type { BotContext } from '../context'
import { markUserReachable, syncChatMembership } from '../web-client'

import { canPostMessages } from './chat-link'

/**
 * `my_chat_member`:
 * - личный чат со статусом `member` — пользователь (заново) разрешил писать боту (разблокировка,
 *   20.3.3): снять `users.bot_blocked_at`. Блокировку (`kicked`) не фиксируем: её определяет
 *   доставка (20.3.2);
 * - групповой чат или супергруппа — бота добавили, исключили или сменили права (20.3.4): web
 *   обновляет существующую привязку (исключение снимает её и освобождает чат, потеря права писать
 *   делает недействительной). Новый чат это обновление не привязывает — только код администратора.
 */
export function registerMyChatMemberHandler(bot: Bot<BotContext>): void {
  bot.on('my_chat_member', async (ctx) => {
    const u = ctx.myChatMember
    if (u.chat.type === 'private') {
      if (u.new_chat_member.status === 'member') await markUserReachable(u.from.id)
      return
    }
    if (u.chat.type === 'group' || u.chat.type === 'supergroup') {
      const member = u.new_chat_member
      await syncChatMembership({
        chatId: String(u.chat.id),
        chatType: u.chat.type,
        title: u.chat.title,
        // ограниченный бот, которого в чате уже нет, — то же, что исключённый
        status: member.status === 'restricted' && !member.is_member ? 'left' : member.status,
        canPost: canPostMessages(u.new_chat_member),
      })
    }
  })
}
