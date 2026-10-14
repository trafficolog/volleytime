<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { TELEGRAM_WIDGET_CALLBACK, TELEGRAM_WIDGET_SCRIPT } from '../utils/telegram-widget'

/**
 * Официальная кнопка Telegram Login Widget (D-05). Данные приходят только в JS-callback
 * (`data-onauth`): `data-auth-url` не используется, подписанные данные не попадают в URL,
 * логи и историю браузера. Сам виджет рисуется Telegram во фрейме и не стилизуется токенами.
 */
const props = defineProps<{ botUsername: string }>()
const emit = defineEmits<{ auth: [user: Record<string, unknown>]; ready: [] }>()

const host = ref<HTMLElement | null>(null)
let observer: MutationObserver | undefined
const win = () => window as unknown as Record<string, unknown>

onMounted(() => {
  // Имя бота попадает в атрибут: пропускаем только формат username Telegram.
  if (!host.value || !/^[A-Za-z0-9_]{5,32}$/.test(props.botUsername)) return
  win()[TELEGRAM_WIDGET_CALLBACK] = (user: Record<string, unknown>) => emit('auth', user)
  const script = document.createElement('script')
  script.async = true
  script.src = TELEGRAM_WIDGET_SCRIPT
  script.setAttribute('data-telegram-login', props.botUsername)
  script.setAttribute('data-size', 'large')
  script.setAttribute('data-radius', '12')
  script.setAttribute('data-userpic', 'false')
  script.setAttribute('data-onauth', `${TELEGRAM_WIDGET_CALLBACK}(user)`)
  // Telegram заменяет скрипт на iframe с кнопкой; пока её нет (скрипт заблокирован, домен бота
  // не задан), страница не показывает ни кнопку, ни разделитель «или».
  observer = new MutationObserver(() => {
    if (host.value?.querySelector('iframe')) {
      observer?.disconnect()
      emit('ready')
    }
  })
  observer.observe(host.value, { childList: true, subtree: true })
  host.value.appendChild(script)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  delete win()[TELEGRAM_WIDGET_CALLBACK]
  host.value?.replaceChildren()
})
</script>

<template>
  <div
    ref="host"
    role="group"
    aria-label="Вход через Telegram"
    data-testid="telegram-login-widget"
    class="vt-tg-widget"
  />
</template>

<style scoped>
.vt-tg-widget {
  display: flex;
  justify-content: center;
  min-height: 40px;
}
</style>
