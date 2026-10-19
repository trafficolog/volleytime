import type { Bot } from 'grammy'

import type { BotContext } from '../context'

export const GROUP_HINT_TEXT =
  'Эта команда работает в личном чате с ботом: откройте его и напишите там.'

/** `/start` в группе — частый первый шаг при добавлении бота: подсказываем привязку чата. */
export const GROUP_START_HINT_TEXT =
  'Чтобы привязать чат к группе, администратор отправляет здесь /link <код> (код выдаёт организатор в кабинете). Остальные команды работают в личном чате с ботом.'

/** Команды, которые работают только в личном чате (данные игрока, кнопки Mini App, reply-меню). */
export const PRIVATE_ONLY_COMMANDS = ['start', 'games', 'my', 'menu', 'help']

/**
 * В групповом чате команды личного чата не выполняются (20.3.4): ни данных записей, ни кнопок
 * `web_app`, ни reply-клавиатуры — только одна строка-подсказка без клавиатуры.
 */
export function registerGroupHintHandler(bot: Bot<BotContext>): void {
  const groups = bot.chatType(['group', 'supergroup'])
  groups.command('start', async (ctx) => {
    await ctx.reply(GROUP_START_HINT_TEXT)
  })
  groups.command(
    PRIVATE_ONLY_COMMANDS.filter((c) => c !== 'start'),
    async (ctx) => {
      await ctx.reply(GROUP_HINT_TEXT)
    },
  )
}
