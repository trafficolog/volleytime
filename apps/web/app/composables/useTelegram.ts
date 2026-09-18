interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: { id: number; first_name: string; username?: string }
    start_param?: string
  }
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  ready: () => void
  expand: () => void
  close: () => void
  onEvent?: (event: string, cb: () => void) => void
  offEvent?: (event: string, cb: () => void) => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  showConfirm?: (message: string, cb: (ok: boolean) => void) => void
  MainButton: {
    text: string
    isVisible: boolean
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
    setText: (text: string) => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  BackButton: {
    isVisible: boolean
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp }
  }
}

/**
 * Маппинг themeParams Telegram на токены дизайн-системы (Task 8.8.4).
 * Акцентные цвета статусов (grass/rose/amber) не переопределяются — они несут смысл.
 */
export const THEME_TOKEN_MAP: Record<string, string[]> = {
  bg_color: ['--vt-paper'],
  secondary_bg_color: ['--vt-bone', '--vt-bone-2'],
  text_color: ['--vt-ink'],
  hint_color: ['--vt-mute', '--vt-mute-2'],
  section_separator_color: ['--vt-stroke', '--vt-stroke-2'],
  button_color: ['--vt-flame'],
  button_text_color: ['--vt-on-accent'],
}

/** Чистая функция для тестов: какие переменные выставить по themeParams. */
export function themeVariables(params: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue
    for (const token of THEME_TOKEN_MAP[key] ?? []) out[token] = value
    out[`--tg-${key.replace(/_/g, '-')}`] = value
  }
  return out
}

export function useTelegram() {
  // SDK подключается скриптом в <head> (8.8.1); объект доступен только на клиенте
  const tg = import.meta.client ? window.Telegram?.WebApp : undefined
  /** В обычном браузере SDK тоже загружается, но initData пуст — это не Telegram. */
  const isTelegram = computed(() => !!tg?.initData)
  const startParam = computed(() => {
    if (!import.meta.client) return null
    const fromSdk = tg?.initDataUnsafe?.start_param
    if (fromSdk) return fromSdk
    const url = new URL(window.location.href)
    return url.searchParams.get('tgWebAppStartParam') ?? url.searchParams.get('startapp')
  })

  function init() {
    if (!tg) return
    tg.ready()
    tg.expand()
    applyTheme()
    tg.onEvent?.('themeChanged', applyTheme)
  }

  /** Применяет тему Telegram к токенам --vt-* (light/dark). */
  function applyTheme() {
    if (!tg || !import.meta.client) return
    const root = document.documentElement
    root.classList.toggle('dark', tg.colorScheme === 'dark')
    for (const [name, value] of Object.entries(themeVariables(tg.themeParams))) {
      root.style.setProperty(name, value)
    }
    const bg = tg.themeParams.bg_color
    if (bg) {
      tg.setHeaderColor?.(bg)
      tg.setBackgroundColor?.(bg)
    }
  }

  /**
   * Управление MainButton. Возвращает cleanup — обязательно вызывать в onUnmounted,
   * иначе обработчик утечёт на следующий экран.
   */
  function useMainButton(text: string, onClick: () => void) {
    if (!tg) return () => {}
    const handler = () => onClick()
    tg.MainButton.setText(text)
    tg.MainButton.offClick(handler) // защита от дублей
    tg.MainButton.onClick(handler)
    tg.MainButton.show()
    return () => {
      tg.MainButton.offClick(handler)
      tg.MainButton.hide()
    }
  }

  function useBackButton(onClick: () => void) {
    if (!tg) return () => {}
    const handler = () => onClick()
    tg.BackButton.offClick(handler)
    tg.BackButton.onClick(handler)
    tg.BackButton.show()
    return () => {
      tg.BackButton.offClick(handler)
      tg.BackButton.hide()
    }
  }

  function haptic(type: 'success' | 'error' | 'warning' | 'light' | 'medium' | 'heavy' = 'light') {
    if (!tg) return
    if (type === 'success' || type === 'error' || type === 'warning') {
      tg.HapticFeedback.notificationOccurred(type)
    } else {
      tg.HapticFeedback.impactOccurred(type)
    }
  }

  /** Подтверждение действия: Telegram showConfirm, вне Telegram — диалог браузера (5.13.18). */
  function confirm(message: string): Promise<boolean> {
    if (tg?.showConfirm) {
      return new Promise((resolve) => tg.showConfirm!(message, (ok) => resolve(ok)))
    }
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false)
  }

  async function authenticate(): Promise<{ isNewUser: boolean } | null> {
    if (!tg?.initData) return null
    const result = await $fetch<{ isNewUser: boolean }>('/api/auth/sign-in/telegram', {
      method: 'POST',
      body: { initData: tg.initData },
    })
    // сессия better-auth установлена cookie — синхронизируем useAuth (3.9.4)
    await useAuth().fetchSession()
    return result
  }

  return {
    confirm,
    isTelegram,
    startParam,
    init,
    applyTheme,
    useMainButton,
    useBackButton,
    haptic,
    authenticate,
    webApp: tg,
  }
}
