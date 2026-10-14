<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { TELEGRAM_WIDGET_SCRIPT, type TelegramWindow } from '../utils/telegram-widget'

/**
 * Кнопка «Войти через Telegram» (D-05). Своя кнопка вызывает `Telegram.Login.auth` из
 * официального telegram-widget.js и получает данные в JS-колбэке: ни `data-auth-url`
 * (данные попали бы в URL), ни `data-onauth` (скрипт Telegram превращает строку в функцию
 * через eval, а CSP без 'unsafe-eval' это блокирует) не используются.
 * Кнопка появляется, только когда скрипт загружен и `Telegram.Login` существует.
 */
const props = defineProps<{ botId: number }>()
const emit = defineEmits<{ auth: [user: Record<string, unknown>]; ready: [] }>()

const ready = ref(false)
const win = () => window as unknown as TelegramWindow

function markReadyIfAvailable(): boolean {
  if (typeof win().Telegram?.Login?.auth !== 'function') return false
  ready.value = true
  emit('ready')
  return true
}

onMounted(() => {
  if (!Number.isSafeInteger(props.botId) || props.botId <= 0) return
  if (markReadyIfAvailable()) return
  const script = document.createElement('script')
  script.async = true
  script.src = TELEGRAM_WIDGET_SCRIPT
  script.addEventListener('load', markReadyIfAvailable)
  document.head.appendChild(script)
})

function start() {
  win().Telegram?.Login?.auth({ bot_id: props.botId, request_access: false }, (user) => {
    // false — человек закрыл окно Telegram или отказал: это не ошибка
    if (user && typeof user === 'object') emit('auth', user)
  })
}
</script>

<template>
  <button
    v-if="ready"
    type="button"
    class="vt-btn vt-btn--ink vt-btn--lg vt-btn--full"
    data-testid="telegram-login-button"
    @click="start"
  >
    <VtIcon name="tg" :size="17" /> Войти через Telegram
  </button>
</template>
