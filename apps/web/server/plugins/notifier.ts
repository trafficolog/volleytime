import { setNotifierTransport } from '@volley-time/core'

/**
 * Настраивает транспорт доставки уведомлений: web -> bot (internal HTTP) -> Telegram.
 * Секрет и URL из runtimeConfig; таймаут чтобы медленный бот не держал запрос.
 */
export default defineNitroPlugin(() => {
  setNotifierTransport({
    async send(payload) {
      const { botInternalUrl, botInternalSecret } = getServerConfig()
      try {
        await $fetch(`${botInternalUrl}/internal/notify`, {
          method: 'POST',
          headers: { 'x-internal-secret': botInternalSecret },
          body: payload,
          timeout: 5000,
        })
      } catch (e) {
        // без секрета в логах: только адрес и код ответа (Task 8.8.2)
        const status =
          (e as { statusCode?: number; status?: number })?.statusCode ??
          (e as { status?: number })?.status
        console.error('[notify] delivery failed', { url: botInternalUrl, status })
        throw e
      }
    },
  })
})
