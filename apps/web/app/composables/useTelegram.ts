import { initTelegramWebApp } from '../utils/telegram-shell'

export interface TelegramWebApp {
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
  setBottomBarColor?: (color: string) => void
  disableVerticalSwipes?: () => void
  safeAreaInset?: { top: number; bottom: number; left: number; right: number }
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number }
  isVersionAtLeast?: (version: string) => boolean
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

/** The SDK can exist outside Telegram or expose popup methods on older clients. */
export function confirmWithFallback(
  message: string,
  webApp: Pick<TelegramWebApp, 'initData' | 'isVersionAtLeast' | 'showConfirm'> | undefined,
  browserConfirm?: (message: string) => boolean,
): Promise<boolean> {
  if (webApp?.initData && webApp.showConfirm && webApp.isVersionAtLeast?.('6.2')) {
    return new Promise((resolve) => webApp.showConfirm!(message, resolve))
  }
  return Promise.resolve(browserConfirm?.(message) ?? false)
}

export function useTelegram() {
  // SDK подключается скриптом в <head> (8.8.1); объект доступен только на клиенте
  const tg = import.meta.client ? window.Telegram?.WebApp : undefined
  /** В обычном браузере SDK тоже загружается, но initData пуст — это не Telegram. */
  const isTelegram = computed(() => !!tg?.initData)
  /** Системная BackButton поддерживается (Bot API 6.1+) — своя кнопка в шапке не нужна. */
  const nativeBack = computed(() => isTelegram.value && !!tg?.isVersionAtLeast?.('6.1'))
  const startParam = computed(() => {
    if (!import.meta.client) return null
    const fromSdk = tg?.initDataUnsafe?.start_param
    if (fromSdk) return fromSdk
    const url = new URL(window.location.href)
    return url.searchParams.get('tgWebAppStartParam') ?? url.searchParams.get('startapp')
  })

  function init() {
    initTelegramWebApp(tg)
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

  function haptic(
    type: 'success' | 'error' | 'warning' | 'light' | 'medium' | 'heavy' | 'selection' = 'light',
  ) {
    if (!tg) return
    if (type === 'selection') {
      tg.HapticFeedback.selectionChanged()
      return
    }
    if (type === 'success' || type === 'error' || type === 'warning') {
      tg.HapticFeedback.notificationOccurred(type)
    } else {
      tg.HapticFeedback.impactOccurred(type)
    }
  }

  /** Подтверждение действия: Telegram 6.2+ showConfirm, иначе диалог браузера (5.13.18). */
  function confirm(message: string): Promise<boolean> {
    return confirmWithFallback(
      message,
      tg,
      typeof window !== 'undefined' ? window.confirm.bind(window) : undefined,
    )
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
    nativeBack,
    startParam,
    init,
    useMainButton,
    haptic,
    authenticate,
    webApp: tg,
  }
}
