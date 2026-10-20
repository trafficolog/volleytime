import type { Bot } from 'grammy'
import type { ChatMember } from 'grammy/types'

import type { BotContext } from '../context'
import { claimChatLink } from '../web-client'

import { esc } from './format'

export const PRIVATE_TEXT =
  'Привязать чат можно только в самом групповом чате: добавьте меня в чат и отправьте там /link <код> — код выдаёт организатор в кабинете.'
export const USAGE_TEXT =
  'Отправьте команду с кодом из кабинета: /link ABCD-EFGH. Код выдаёт организатор группы.'
export const ANONYMOUS_TEXT =
  'Отправьте команду от своего имени: анонимного администратора я проверить не могу.'
export const NOT_ADMIN_TEXT =
  'Привязать чат может только администратор этого чата. Код сгорел — выпустите новый в кабинете.'
export const CODE_INVALID_TEXT = 'Код недействителен или истёк. Выпустите новый код в кабинете.'
export const CHAT_TAKEN_TEXT =
  'Этот чат уже привязан к другой группе. Код сгорел — выпустите новый в кабинете, когда чат освободится.'
export const GROUP_HAS_CHAT_TEXT =
  'У группы уже привязан чат. Код сгорел — отвяжите прежний чат в кабинете и выпустите новый код.'
export const NO_RIGHTS_TEXT =
  'Сейчас я не могу писать в этом чате: выдайте мне право отправлять сообщения (лучше сделать меня администратором).'
export const UNAVAILABLE_TEXT = 'Сервис временно недоступен, попробуйте чуть позже.'

/**
 * Может ли бот писать в чат по его собственной записи `getChatMember`. Граница: у обычного `member`
 * Telegram не показывает общие ограничения чата (`chat.permissions`: например, «никому нельзя
 * писать»), поэтому `true` здесь не гарантия — о таком запрете станет известно при первой неудачной
 * отправке анонса (`telegram_chat.no_rights`, привязка помечается недействительной).
 */
export function canPostMessages(member: ChatMember): boolean {
  switch (member.status) {
    case 'creator':
    case 'administrator':
    case 'member':
      return true
    case 'restricted':
      // ограниченный бот, которого в чате уже нет (`is_member: false`), писать не может
      return member.is_member && member.can_send_messages
    default:
      return false
  }
}

/**
 * `/link <код>` в групповом чате (20.3.4). Код принимается только от администратора чата
 * (creator/administrator по `getChatMember` отправителя); право бота писать проверяется по его
 * собственному `getChatMember`. Остальное решает web: код привязан к группе, одноразовый и с TTL.
 * Код и идентификаторы в логи не попадают; команда с кодом удаляется из чата, если у бота есть право.
 */
export function registerChatLinkHandler(bot: Bot<BotContext>): void {
  bot.command('link', async (ctx) => {
    const chat = ctx.chat
    if (chat.type === 'private') {
      await ctx.reply(PRIVATE_TEXT)
      return
    }
    if (chat.type !== 'group' && chat.type !== 'supergroup') return
    const code = String(ctx.match ?? '').trim()
    // код прозвучал в чате: при любом исходе, кроме привязки, он сгорает, а сообщение с ним
    // удаляется (если у бота есть право) — решение владельца 2026-10-20
    const burnAndClean = async () => {
      if (!code) return
      await claimChatLink({ verdict: 'rejected', code, chatId: String(chat.id) })
      await ctx.deleteMessage().catch(() => {})
    }
    // анонимный администратор пишет от имени чата: настоящего отправителя проверить нельзя
    if (!ctx.from || ctx.msg?.sender_chat) {
      await burnAndClean()
      await ctx.reply(ANONYMOUS_TEXT)
      return
    }
    if (!code) {
      await ctx.reply(USAGE_TEXT)
      return
    }

    let botCanPost: boolean
    try {
      const sender = await ctx.api.getChatMember(chat.id, ctx.from.id)
      if (sender.status !== 'creator' && sender.status !== 'administrator') {
        await burnAndClean()
        await ctx.reply(NOT_ADMIN_TEXT)
        return
      }
      botCanPost = canPostMessages(await ctx.api.getChatMember(chat.id, ctx.me.id))
    } catch {
      await burnAndClean()
      await ctx.reply(UNAVAILABLE_TEXT)
      return
    }

    const res = await claimChatLink({
      verdict: 'admin',
      code,
      chatId: String(chat.id),
      chatType: chat.type,
      title: chat.title,
      botCanPost,
      confirmedByTelegramId: String(ctx.from.id),
    })
    await ctx.deleteMessage().catch(() => {})

    if (!res) {
      await ctx.reply(UNAVAILABLE_TEXT)
    } else if (res.outcome === 'linked') {
      const text = `✅ Чат привязан к группе <b>${esc(res.organizationName)}</b>. Анонсы событий будут приходить сюда.`
      await ctx.reply(
        res.botCanPost
          ? text
          : `${text}

⚠️ ${NO_RIGHTS_TEXT}`,
        {
          parse_mode: 'HTML',
        },
      )
    } else {
      await ctx.reply(
        {
          code_invalid: CODE_INVALID_TEXT,
          chat_taken: CHAT_TAKEN_TEXT,
          group_has_chat: GROUP_HAS_CHAT_TEXT,
          rejected: NOT_ADMIN_TEXT,
        }[res.outcome],
      )
    }
  })
}
