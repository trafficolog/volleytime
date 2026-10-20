import { deliveryErrorFromStatus, setNotifierTransport } from '@volley-time/core'

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
        // 410 — получатель недоступен, 429 — лимит Bot API с `retry-after` (20.3.2)
        const retryAfter = Number(
          (
            e as { response?: { headers?: { get?: (n: string) => string | null } } }
          )?.response?.headers?.get?.('retry-after'),
        )
        // причина недоступности группового чата (20.3.4): бот исключён, нет прав, чат перенесён
        const reason =
          (
            e as { response?: { headers?: { get?: (n: string) => string | null } } }
          )?.response?.headers?.get?.('x-failure-reason') ?? undefined
        throw deliveryErrorFromStatus(
          status,
          Number.isNaN(retryAfter) ? undefined : retryAfter,
          reason,
        )
      }
    },
  })
})
