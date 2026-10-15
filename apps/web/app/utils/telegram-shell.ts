import type { TelegramWebApp } from '../composables/useTelegram'

import {
  closeTopBackOverlay,
  isFormRoute,
  miniAppBackTarget,
  overlayCount,
  subscribeBackOverlays,
} from './miniapp-back'

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

type Insets = { top: number; bottom: number; left: number; right: number }
const SIDES = ['top', 'right', 'bottom', 'left'] as const
const initialised = new WeakMap<object, () => void>()

function applyTheme(tg: TelegramWebApp, root: HTMLElement) {
  root.classList.toggle('dark', tg.colorScheme === 'dark')
  for (const [name, value] of Object.entries(themeVariables(tg.themeParams ?? {}))) {
    root.style.setProperty(name, value)
  }
  const bg = tg.themeParams?.bg_color
  if (bg) {
    tg.setHeaderColor?.(bg)
    tg.setBackgroundColor?.(bg)
    tg.setBottomBarColor?.(bg)
  }
}

function applyInsets(root: HTMLElement, prefix: string, insets: Insets | undefined) {
  if (!insets) return
  for (const side of SIDES) root.style.setProperty(`${prefix}-${side}`, `${insets[side] ?? 0}px`)
}

/** Безопасные зоны: устройство (вырез, home indicator) и интерфейс Telegram (полный экран). */
function applySafeArea(tg: TelegramWebApp, root: HTMLElement) {
  applyInsets(root, '--tg-safe-area-inset', tg.safeAreaInset)
  applyInsets(root, '--tg-content-safe-area-inset', tg.contentSafeAreaInset)
}

/**
 * Включает нативное поведение Telegram: ready, expand, запрет закрытия свайпом вниз,
 * тема и безопасные зоны с подпиской на их смену. Повторный вызов для того же объекта
 * ничего не делает. Вне Telegram (`undefined`) — пустая операция.
 */
export function initTelegramWebApp(
  tg: TelegramWebApp | undefined,
  root: HTMLElement | undefined = typeof document === 'undefined'
    ? undefined
    : document.documentElement,
): () => void {
  if (!tg || !root) return () => {}
  const existing = initialised.get(tg)
  if (existing) return existing

  tg.ready()
  tg.expand()
  // Свайп вниз закрывает Mini App и теряет несохранённую форму (Bot API 7.7).
  if (tg.disableVerticalSwipes && tg.isVersionAtLeast?.('7.7')) tg.disableVerticalSwipes()
  const onTheme = () => applyTheme(tg, root)
  const onSafeArea = () => applySafeArea(tg, root)
  onTheme()
  onSafeArea()
  const events: Array<[string, () => void]> = [
    ['themeChanged', onTheme],
    ['safeAreaChanged', onSafeArea],
    ['contentSafeAreaChanged', onSafeArea],
    ['fullscreenChanged', onSafeArea],
  ]
  for (const [name, cb] of events) tg.onEvent?.(name, cb)

  const dispose = () => {
    for (const [name, cb] of events) tg.offEvent?.(name, cb)
    initialised.delete(tg)
  }
  initialised.set(tg, dispose)
  return dispose
}

export interface BackNavigation {
  currentPath: () => string
  /** Предыдущая запись истории роутера или `null` (глубокая ссылка, перезагрузка). */
  previousPath: () => string | null
  navigate: (path: string) => void
  historyBack: () => void
}

/**
 * Системная BackButton: видна на всех внутренних экранах и пока открыт лист/диалог.
 * Порядок «назад»: закрыть наложение → вернуться по истории на то же место → родитель.
 */
export function createBackController(tg: TelegramWebApp | undefined, nav: BackNavigation) {
  const available = !!tg?.BackButton && (tg.isVersionAtLeast ? tg.isVersionAtLeast('6.1') : true)
  if (!tg || !available) return { available: false, sync() {}, stop() {} }

  let shown = false
  const handler = () => {
    if (closeTopBackOverlay()) return
    const current = nav.currentPath()
    const target = miniAppBackTarget(current)
    if (!target) return
    const previous = nav.previousPath()
    const canReturn =
      !!previous &&
      previous.startsWith('/m/') &&
      !previous.startsWith('/m/invite/') &&
      previous !== current &&
      !isFormRoute(previous)
    if (canReturn) nav.historyBack()
    else nav.navigate(target)
  }
  const sync = () => {
    const visible = overlayCount() > 0 || miniAppBackTarget(nav.currentPath()) !== null
    if (visible === shown) return
    shown = visible
    if (visible) tg.BackButton.show()
    else tg.BackButton.hide()
  }
  tg.BackButton.onClick(handler)
  const unsubscribe = subscribeBackOverlays(sync)
  return {
    available: true,
    sync,
    stop() {
      unsubscribe()
      tg.BackButton.offClick(handler)
      if (shown) tg.BackButton.hide()
      shown = false
    },
  }
}

export interface MainButtonState {
  text: string
  disabled?: boolean
  loading?: boolean
}

/** Реактивная обёртка MainButton: `update(state)` синхронизирует, `null` прячет. */
export function createMainButton(tg: TelegramWebApp | undefined, onClick: () => void) {
  if (!tg?.MainButton) return { update(_state: MainButtonState | null) {}, destroy() {} }
  const button = tg.MainButton
  const handler = () => onClick()
  button.onClick(handler)
  return {
    update(state: MainButtonState | null) {
      if (!state) {
        button.hideProgress()
        button.hide()
        return
      }
      button.setText(state.text)
      if (state.disabled || state.loading) button.disable()
      else button.enable()
      if (state.loading) button.showProgress(false)
      else button.hideProgress()
      button.show()
    },
    destroy() {
      button.offClick(handler)
      button.hideProgress()
      button.hide()
    },
  }
}
