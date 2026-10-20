import { Keyboard, type Bot } from 'grammy'

import type { BotContext } from '../context'

export const MENU_GAMES = 'Расписание'
export const MENU_MY = 'Мои записи'
export const MENU_HELP = 'Помощь'

/** Reply-клавиатура под полем ввода (макет «BotMenu»): тексты кнопок приходят как обычные сообщения. */
export function menuKeyboard(): Keyboard {
  return new Keyboard().text(MENU_GAMES).text(MENU_MY).row().text(MENU_HELP).resized().persistent()
}

export const MENU_TEXT = 'Меню закреплено под полем ввода.\nЗаписи и оплаты — в приложении.'

/** Отправить меню (`/menu`, после `/start`). */
export async function sendMenu(ctx: BotContext): Promise<void> {
  await ctx.reply(MENU_TEXT, { reply_markup: menuKeyboard() })
}

export function registerMenuHandler(bot: Bot<BotContext>): void {
  bot.chatType('private').command('menu', sendMenu)
}
