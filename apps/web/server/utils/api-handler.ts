import type { EventHandlerRequest, H3Event } from 'h3'

/**
 * Обёртка API-хендлера с единой обработкой ошибок (Task 4.9.11):
 * доменные ошибки → статус по коду, ZodError → 422 без дампа, неизвестные → 500 без деталей.
 */
export function defineApiHandler<T>(fn: (event: H3Event<EventHandlerRequest>) => Promise<T> | T) {
  return defineEventHandler(async (event) => {
    try {
      return await fn(event)
    } catch (e) {
      return handleServiceError(e)
    }
  })
}
