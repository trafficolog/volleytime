import { Bot } from 'grammy'

import type { BotContext } from './context'
import { env } from './env'

export function createBot(): Bot<BotContext> {
  return new Bot<BotContext>(env.BOT_TOKEN)
}
