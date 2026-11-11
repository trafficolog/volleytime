import { setBotChatInfoTransport } from '@volley-time/core'

/**
 * Канал web -> bot за числом участников чата и состоянием webhook (21.4.6): внутренний HTTP под
 * секретом, короткий таймаут, чтобы недоступный бот не задерживал блок «Telegram-бот». Ошибка
 * пробрасывается в `loadBotChatInfo`, который превращает её в «недоступно»; в лог — только код ответа.
 */
export default defineNitroPlugin(() => {
  setBotChatInfoTransport({
    async chatInfo(chatId) {
      const { botInternalUrl, botInternalSecret } = getServerConfig()
      try {
        return await $fetch(`${botInternalUrl}/internal/chat-info`, {
          method: 'POST',
          headers: { 'x-internal-secret': botInternalSecret },
          body: { chatId },
          timeout: 3000,
        })
      } catch (e) {
        const status =
          (e as { statusCode?: number; status?: number })?.statusCode ??
          (e as { status?: number })?.status
        console.error('[bot-chat-info] request failed', { url: botInternalUrl, status })
        throw new Error('bot chat-info unavailable')
      }
    },
  })
})
