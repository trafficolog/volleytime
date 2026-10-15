import { startMiniAppShell } from '../utils/telegram-shell'

/**
 * Оболочка Telegram Mini App (Task 20.4.1): тема, безопасные зоны и системная BackButton
 * на всех экранах `/m/**`, а не только при входе через `/m`. Вне Telegram (обычный браузер,
 * тесты) initData пуст — плагин ничего не делает.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const shell = startMiniAppShell(window.Telegram?.WebApp, useRouter(), () => window.history.state)
  if (shell) nuxtApp.hook('app:mounted', () => shell.sync())
})
