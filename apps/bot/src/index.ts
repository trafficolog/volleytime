import { createBot } from './client'
import { env } from './env'
import { BOT_COMMANDS, registerHelpHandler } from './handlers/help'
import { registerCallbackHandler } from './handlers/callbacks'
import { registerFallbackHandler } from './handlers/fallback'
import { registerGamesHandler } from './handlers/games'
import { registerMenuHandler } from './handlers/menu'
import { registerMyChatMemberHandler } from './handlers/my-chat-member'
import { registerMyHandler } from './handlers/my'
import { registerStartHandler } from './handlers/start'
import { startInternalServer } from './internal-server'
import {
  logFatalError,
  registerErrorHandler,
  setupGracefulShutdown,
  withRetries,
} from './lifecycle'
import { initSentry } from './sentry'
import { loggingMiddleware } from './middlewares/logging'
import { registerWebhook, startWebhookServer } from './webhook-server'

/** Нужные боту типы обновлений (по умолчанию Telegram их тоже отдаёт; фиксируем явно). */
export const ALLOWED_UPDATES = ['message', 'callback_query', 'my_chat_member'] as const

async function main(): Promise<void> {
  initSentry()
  const bot = createBot()
  bot.use(loggingMiddleware)
  registerStartHandler(bot)
  registerHelpHandler(bot)
  registerGamesHandler(bot)
  registerMyHandler(bot)
  registerMenuHandler(bot)
  registerCallbackHandler(bot)
  registerMyChatMemberHandler(bot)
  registerFallbackHandler(bot) // последним: прочие сообщения
  registerErrorHandler(bot)
  // internal notify + health поднимаем ДО обращений к Telegram: /healthz доступен,
  // пока идут ретраи подключения (Task 9.9.10)
  const servers = [startInternalServer(bot, env.INTERNAL_PORT)]
  setupGracefulShutdown({ bot, servers })

  await withRetries(() => bot.api.setMyCommands(BOT_COMMANDS), { label: 'setMyCommands' })

  if (env.BOT_MODE === 'webhook') {
    console.log('[bot] starting in webhook mode…')
    await withRetries(() => bot.init(), { label: 'bot.init' })
    await withRetries(() => registerWebhook(bot), { label: 'setWebhook' })
    servers.push(startWebhookServer(bot, env.WEBHOOK_PORT))
  } else {
    console.log('[bot] starting in polling mode…')
    await bot.api.deleteWebhook().catch(() => {})
    await bot.start({ allowed_updates: ALLOWED_UPDATES })
  }
}

// запуск только при прямом вызове (не при импорте в тестах)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    logFatalError(err)
    process.exit(1)
  })
}
