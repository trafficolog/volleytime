import { InlineKeyboard, type Bot } from 'grammy'

import type { BotContext } from '../context'
import { env } from '../env'

export const FALLBACK_TEXT =
  'Я понимаю команды /start и /help 🏐\n\nЗаписи, абонементы и оплаты — в приложении, откройте его кнопкой ниже.'

/**
 * Ответ на любые прочие сообщения в личном чате (AC 3.5.2, Task 3.9.7).
 * Регистрировать ПОСЛЕДНИМ, после команд.
 */
export function registerFallbackHandler(bot: Bot<BotContext>): void {
  bot.on('message', async (ctx) => {
    if (ctx.chat.type !== 'private') return
    await ctx.reply(FALLBACK_TEXT, {
      reply_markup: new InlineKeyboard().webApp('🏐 Открыть приложение', `${env.WEB_URL}/m/`),
    })
  })
}
