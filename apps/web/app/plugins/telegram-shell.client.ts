import { createBackController, initTelegramWebApp } from '../utils/telegram-shell'

/**
 * Оболочка Telegram Mini App (Task 20.4.1): тема, безопасные зоны и системная BackButton
 * на всех экранах `/m/**`, а не только при входе через `/m`. Вне Telegram (обычный браузер,
 * тесты) initData пуст — плагин ничего не делает.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const tg = window.Telegram?.WebApp
  if (!tg?.initData) return

  initTelegramWebApp(tg)
  const router = useRouter()
  const back = createBackController(tg, {
    currentPath: () => router.currentRoute.value.fullPath,
    previousPath: () => {
      const previous = (window.history.state as { back?: unknown } | null)?.back
      return typeof previous === 'string' ? previous : null
    },
    navigate: (path) => void router.push(path),
    historyBack: () => router.back(),
  })
  if (!back.available) return

  router.afterEach(() => back.sync())
  nuxtApp.hook('app:mounted', () => back.sync())
})
