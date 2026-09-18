import * as Sentry from '@sentry/node'

/**
 * Sentry для серверной части web (Task 9.9.6). Включается только при наличии DSN.
 * Трассировка выключена, PII не отправляем (initData, секреты, тела запросов).
 */
export default defineNitroPlugin((nitroApp) => {
  const dsn = process.env.SENTRY_DSN_WEB || process.env.SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.RELEASE_VERSION,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.request?.data
      delete event.request?.cookies
      if (event.request?.headers) delete event.request.headers
      return event
    },
  })
  console.log('[sentry] web error reporting enabled')

  nitroApp.hooks.hook('error', (error, { event }) => {
    Sentry.captureException(error, { tags: { path: event?.path } })
  })
})
