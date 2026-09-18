import * as Sentry from '@sentry/node'

/** Sentry для бота (Task 9.9.6). Без DSN — no-op. */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN_BOT || process.env.SENTRY_DSN
  if (!dsn) return false
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.RELEASE_VERSION,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  })
  console.log('[sentry] bot error reporting enabled')
  return true
}

/** Отправить ошибку, если Sentry включён (иначе тихо игнорируем). */
export function captureError(error: unknown, context: Record<string, unknown> = {}): void {
  if (!Sentry.getClient()) return
  Sentry.captureException(error, { extra: context })
}
