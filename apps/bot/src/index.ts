import { createBot } from './client'
import { env } from './env'
import { BOT_COMMANDS, registerHelpHandler } from './handlers/help'
import { registerFallbackHandler } from './handlers/fallback'
import { registerStartHandler } from './handlers/start'
import { startInternalServer } from './internal-server'
import { registerErrorHandler, setupGracefulShutdown, withRetries } from './lifecycle'
import { initSentry } from './sentry'
import { loggingMiddleware } from './middlewares/logging'
import { registerWebhook, startWebhookServer } from './webhook-server'

async function main(): Promise<void> {
  initSentry()
  const bot = createBot()
  bot.use(loggingMiddleware)
  registerStartHandler(bot)
  registerHelpHandler(bot)
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
    await bot.start()
  }
}

// запуск только при прямом вызове (не при импорте в тестах)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[bot] fatal:', err)
    process.exit(1)
  })
}
