import { InlineKeyboard, type Bot } from 'grammy'

import type { BotContext } from '../context'
import { env } from '../env'

import { MENU_HELP } from './menu'

export const HELP_TEXT = `🏐 <b>Volley Time</b> — платформа для волейбольных тренировок.

<b>Что умеет приложение:</b>
• Записаться на тренировку и встать в лист ожидания
• Покупать и использовать абонементы
• Смотреть свои записи и отменять их
• Организаторам — события, участники, оплаты и касса

<b>Команды:</b>
/start — открыть приложение
/games — ближайшие события
/my — мои записи
/help — эта справка

Всё остальное — в приложении.`

export function registerHelpHandler(bot: Bot<BotContext>): void {
  const help = async (ctx: BotContext) => {
    await ctx.reply(HELP_TEXT, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().webApp('🏐 Открыть приложение', `${env.WEB_URL}/m/`),
    })
  }
  bot.command('help', help)
  bot.hears(MENU_HELP, async (ctx) => {
    if (ctx.chat.type === 'private') await help(ctx)
  })
}

/** Команды для setMyCommands (меню бота). */
export const BOT_COMMANDS = [
  { command: 'start', description: 'Открыть приложение' },
  { command: 'games', description: 'Ближайшие события' },
  { command: 'my', description: 'Мои записи' },
  { command: 'help', description: 'Справка' },
]
