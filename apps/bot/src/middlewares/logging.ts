import type { MiddlewareFn } from 'grammy'

import type { BotContext } from '../context'

export const loggingMiddleware: MiddlewareFn<BotContext> = async (ctx, next) => {
  const start = Date.now()
  const from = ctx.from?.id ?? 'unknown'
  const type = ctx.update.message ? 'message' : ctx.update.callback_query ? 'callback' : 'update'
  await next()
  console.log(`[bot] ${type} from ${from} (${Date.now() - start}ms)`)
}
