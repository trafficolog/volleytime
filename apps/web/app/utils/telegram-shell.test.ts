// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TelegramWebApp } from '../composables/useTelegram'

import { registerBackOverlay } from './miniapp-back'
import { createBackController, createMainButton, initTelegramWebApp } from './telegram-shell'

type Handler = () => void

function mockWebApp(overrides: Partial<TelegramWebApp> = {}) {
  const events = new Map<string, Set<Handler>>()
  const back = {
    isVisible: false,
    show: vi.fn(() => void (back.isVisible = true)),
    hide: vi.fn(() => void (back.isVisible = false)),
    handlers: new Set<Handler>(),
    onClick: vi.fn((cb: Handler) => void back.handlers.add(cb)),
    offClick: vi.fn((cb: Handler) => void back.handlers.delete(cb)),
  }
  const main = {
    text: '',
    isVisible: false,
    isActive: true,
    handlers: new Set<Handler>(),
    show: vi.fn(() => void (main.isVisible = true)),
    hide: vi.fn(() => void (main.isVisible = false)),
    enable: vi.fn(() => void (main.isActive = true)),
    disable: vi.fn(() => void (main.isActive = false)),
    showProgress: vi.fn(),
    hideProgress: vi.fn(),
    setText: vi.fn((t: string) => void (main.text = t)),
    onClick: vi.fn((cb: Handler) => void main.handlers.add(cb)),
    offClick: vi.fn((cb: Handler) => void main.handlers.delete(cb)),
  }
  const tg = {
    initData: 'signed',
    initDataUnsafe: {},
    colorScheme: 'dark',
    themeParams: { bg_color: '#17212b', text_color: '#f5f5f5' },
    safeAreaInset: { top: 44, bottom: 34, left: 0, right: 0 },
    contentSafeAreaInset: { top: 56, bottom: 0, left: 0, right: 0 },
    ready: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    disableVerticalSwipes: vi.fn(),
    setHeaderColor: vi.fn(),
    setBackgroundColor: vi.fn(),
    setBottomBarColor: vi.fn(),
    isVersionAtLeast: vi.fn(() => true),
    onEvent: vi.fn((name: string, cb: Handler) => {
      if (!events.has(name)) events.set(name, new Set())
      events.get(name)!.add(cb)
    }),
    offEvent: vi.fn((name: string, cb: Handler) => void events.get(name)?.delete(cb)),
    BackButton: back,
    MainButton: main,
    HapticFeedback: {
      impactOccurred: vi.fn(),
      notificationOccurred: vi.fn(),
      selectionChanged: vi.fn(),
    },
    ...overrides,
  } as unknown as TelegramWebApp
  const emit = (name: string) => events.get(name)?.forEach((cb) => cb())
  const pressBack = () => back.handlers.forEach((cb) => cb())
  const pressMain = () => main.handlers.forEach((cb) => cb())
  return { tg, back, main, emit, pressBack, pressMain }
}

afterEach(() => {
  const root = document.documentElement
  root.removeAttribute('style')
  root.className = ''
})

describe('initTelegramWebApp', () => {
  it('signals readiness, expands, locks vertical swipes and applies theme + safe-area vars', () => {
    const { tg } = mockWebApp()
    initTelegramWebApp(tg)
    expect(tg.ready).toHaveBeenCalled()
    expect(tg.expand).toHaveBeenCalled()
    expect(tg.disableVerticalSwipes).toHaveBeenCalled()
    const root = document.documentElement
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.style.getPropertyValue('--vt-paper')).toBe('#17212b')
    expect(tg.setHeaderColor).toHaveBeenCalledWith('#17212b')
    expect(tg.setBottomBarColor).toHaveBeenCalledWith('#17212b')
    expect(root.style.getPropertyValue('--tg-safe-area-inset-top')).toBe('44px')
    expect(root.style.getPropertyValue('--tg-safe-area-inset-bottom')).toBe('34px')
    expect(root.style.getPropertyValue('--tg-content-safe-area-inset-top')).toBe('56px')
  })

  it('reacts to theme and safe-area events and removes listeners on dispose', () => {
    const { tg, emit } = mockWebApp()
    const dispose = initTelegramWebApp(tg)
    ;(tg as { colorScheme: string }).colorScheme = 'light'
    ;(tg as { safeAreaInset: object }).safeAreaInset = { top: 0, bottom: 20, left: 0, right: 0 }
    emit('themeChanged')
    emit('safeAreaChanged')
    const root = document.documentElement
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.style.getPropertyValue('--tg-safe-area-inset-bottom')).toBe('20px')
    dispose()
    expect(tg.offEvent).toHaveBeenCalled()
  })

  it('is idempotent for the same WebApp object', () => {
    const { tg } = mockWebApp()
    initTelegramWebApp(tg)
    initTelegramWebApp(tg)
    expect(tg.ready).toHaveBeenCalledTimes(1)
  })

  it('degrades on old clients without optional methods', () => {
    const { tg } = mockWebApp({
      disableVerticalSwipes: undefined,
      setBottomBarColor: undefined,
      safeAreaInset: undefined,
      contentSafeAreaInset: undefined,
      isVersionAtLeast: undefined,
    })
    expect(() => initTelegramWebApp(tg)).not.toThrow()
    expect(document.documentElement.style.getPropertyValue('--tg-safe-area-inset-top')).toBe('')
  })

  it('does nothing without a WebApp (desktop browser, tests)', () => {
    expect(() => initTelegramWebApp(undefined)).not.toThrow()
  })
})

describe('createBackController', () => {
  let path = '/m/orgs/7/events/42'
  let prev: string | null = null
  const navigate = vi.fn()
  const historyBack = vi.fn()
  beforeEach(() => {
    path = '/m/orgs/7/events/42'
    prev = null
    navigate.mockReset()
    historyBack.mockReset()
  })
  const deps = () => ({
    currentPath: () => path,
    previousPath: () => prev,
    navigate,
    historyBack,
  })

  it('shows the native button on inner screens and hides it on roots', () => {
    const { tg, back } = mockWebApp()
    const ctl = createBackController(tg, deps())
    ctl.sync()
    expect(back.show).toHaveBeenCalled()
    path = '/m/orgs'
    ctl.sync()
    expect(back.hide).toHaveBeenCalled()
    expect(back.isVisible).toBe(false)
  })

  it('goes back through history when the previous entry is an app screen (returns to place)', () => {
    const { tg, pressBack } = mockWebApp()
    prev = '/m/orgs/7/subscriptions'
    createBackController(tg, deps()).sync()
    pressBack()
    expect(historyBack).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('falls back to the parent screen on a deep link (no history)', () => {
    const { tg, pressBack } = mockWebApp()
    createBackController(tg, deps()).sync()
    pressBack()
    expect(navigate).toHaveBeenCalledWith('/m/orgs/7/events')
    expect(historyBack).not.toHaveBeenCalled()
  })

  it('ignores a previous entry outside the Mini App and a form screen', () => {
    const { tg, pressBack } = mockWebApp()
    createBackController(tg, deps()).sync()
    prev = '/auth/login'
    pressBack()
    expect(navigate).toHaveBeenLastCalledWith('/m/orgs/7/events')
    prev = '/m/orgs/7/events/new'
    pressBack()
    expect(navigate).toHaveBeenCalledTimes(2)
    expect(historyBack).not.toHaveBeenCalled()
  })

  it('closes an open sheet before leaving the screen and shows the button on a root screen', () => {
    const { tg, back, pressBack } = mockWebApp()
    path = '/m/orgs'
    const ctl = createBackController(tg, deps())
    ctl.sync()
    expect(back.isVisible).toBe(false)
    const close = vi.fn()
    const unregister = registerBackOverlay(close)
    expect(back.isVisible).toBe(true)
    pressBack()
    expect(close).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
    unregister()
    expect(back.isVisible).toBe(false)
    ctl.stop()
  })

  it('stop() unbinds the click handler and hides the button', () => {
    const { tg, back } = mockWebApp()
    const ctl = createBackController(tg, deps())
    ctl.sync()
    ctl.stop()
    expect(back.handlers.size).toBe(0)
    expect(back.isVisible).toBe(false)
  })

  it('is a no-op without a WebApp or on a client without BackButton (Bot API < 6.1)', () => {
    const none = createBackController(undefined, deps())
    expect(() => {
      none.sync()
      none.stop()
    }).not.toThrow()
    const { tg } = mockWebApp({ isVersionAtLeast: vi.fn(() => false) })
    const old = createBackController(tg, deps())
    old.sync()
    expect(tg.BackButton.show).not.toHaveBeenCalled()
    expect(old.available).toBe(false)
  })
})

describe('createMainButton', () => {
  it('shows text, enabled state and progress, and calls the action once per tap', () => {
    const { tg, main, pressMain } = mockWebApp()
    const action = vi.fn()
    const btn = createMainButton(tg, action)
    btn.update({ text: 'Создать группу' })
    expect(main.setText).toHaveBeenCalledWith('Создать группу')
    expect(main.show).toHaveBeenCalled()
    pressMain()
    expect(action).toHaveBeenCalledTimes(1)
    btn.update({ text: 'Создаём…', disabled: true, loading: true })
    expect(main.disable).toHaveBeenCalled()
    expect(main.showProgress).toHaveBeenCalled()
    btn.update({ text: 'Создать группу' })
    expect(main.enable).toHaveBeenCalled()
    expect(main.hideProgress).toHaveBeenCalled()
  })

  it('hides on null state and cleans up on destroy', () => {
    const { tg, main } = mockWebApp()
    const btn = createMainButton(tg, vi.fn())
    btn.update({ text: 'A' })
    btn.update(null)
    expect(main.hide).toHaveBeenCalled()
    btn.update({ text: 'B' })
    btn.destroy()
    expect(main.handlers.size).toBe(0)
    expect(main.isVisible).toBe(false)
  })

  it('is a no-op outside Telegram', () => {
    const btn = createMainButton(undefined, vi.fn())
    expect(() => {
      btn.update({ text: 'x' })
      btn.destroy()
    }).not.toThrow()
  })
})
