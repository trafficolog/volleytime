---
id: '8.2.1'
phase: '8'
epic: '8.2'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11.'
roles:
  - FE
depends_on:
  - '8.1.3'
estimated_hours: '2'
tags:
  - telegram
  - webapp-sdk
  - mini-app
---

# Task 8.2.1: useTelegram composable + plugin инициализация

## Цель

Типобезопасная обёртка над Telegram WebApp SDK: composable useTelegram() + plugin инициализации (ready/expand). Graceful degradation вне Telegram.

## Контекст

`window.Telegram.WebApp` даёт MainButton, BackButton, themeParams, HapticFeedback, expand/close. Обернём в composable для удобства и типобезопасности. Вне Telegram — no-op заглушки (браузерный fallback не ломается).

## Что должно быть сделано

1. **Типы `apps/web/types/telegram.d.ts`** (минимальные, что используем):

   ```ts
   interface TelegramWebApp {
     initData: string
     initDataUnsafe: { user?: { id: number; first_name: string; username?: string } }
     colorScheme: 'light' | 'dark'
     themeParams: Record<string, string>
     isExpanded: boolean
     ready(): void
     expand(): void
     close(): void
     MainButton: {
       text: string
       isVisible: boolean
       isActive: boolean
       showProgress(leaveActive?: boolean): void
       hideProgress(): void
       setText(text: string): void
       show(): void
       hide(): void
       enable(): void
       disable(): void
       onClick(cb: () => void): void
       offClick(cb: () => void): void
       setParams(params: {
         text?: string
         color?: string
         text_color?: string
         is_active?: boolean
         is_visible?: boolean
       }): void
     }
     BackButton: {
       isVisible: boolean
       show(): void
       hide(): void
       onClick(cb: () => void): void
       offClick(cb: () => void): void
     }
     HapticFeedback: {
       impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
       notificationOccurred(type: 'error' | 'success' | 'warning'): void
       selectionChanged(): void
     }
   }
   interface Window {
     Telegram?: { WebApp: TelegramWebApp }
   }
   ```

2. **Plugin `apps/web/plugins/telegram.client.ts`** — инициализация:

   ```ts
   export default defineNuxtPlugin(() => {
     const tg = window.Telegram?.WebApp
     if (tg) {
       tg.ready()
       tg.expand()
     }
   })
   ```

3. **Composable `apps/web/composables/useTelegram.ts`:**

   ```ts
   export function useTelegram() {
     const tg = import.meta.client ? window.Telegram?.WebApp : undefined
     const isTelegram = computed(() => !!tg)
     const colorScheme = computed(() => tg?.colorScheme ?? 'light')

     // MainButton
     function showMainButton(text: string, onClick: () => void, opts: { loading?: boolean } = {}) {
       if (!tg) return
       tg.MainButton.setText(text)
       tg.MainButton.offClick(onClick) // избегаем дублей
       tg.MainButton.onClick(onClick)
       tg.MainButton.show()
       if (opts.loading) tg.MainButton.showProgress()
       else tg.MainButton.hideProgress()
     }
     function hideMainButton() {
       tg?.MainButton.hide()
     }
     function setMainButtonLoading(loading: boolean) {
       if (!tg) return
       if (loading) tg.MainButton.showProgress()
       else tg.MainButton.hideProgress()
     }
     function enableMainButton(enabled: boolean) {
       if (!tg) return
       if (enabled) tg.MainButton.enable()
       else tg.MainButton.disable()
     }

     // BackButton
     function showBackButton(onClick: () => void) {
       if (!tg) return
       tg.BackButton.offClick(onClick)
       tg.BackButton.onClick(onClick)
       tg.BackButton.show()
     }
     function hideBackButton() {
       tg?.BackButton.hide()
     }

     // Haptics
     function haptic(type: 'success' | 'error' | 'warning') {
       tg?.HapticFeedback.notificationOccurred(type)
     }
     function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
       tg?.HapticFeedback.impactOccurred(style)
     }

     function close() {
       tg?.close()
     }

     return {
       isTelegram,
       colorScheme,
       showMainButton,
       hideMainButton,
       setMainButtonLoading,
       enableMainButton,
       showBackButton,
       hideBackButton,
       haptic,
       hapticImpact,
       close,
     }
   }
   ```

4. **Cleanup паттерн:** MainButton/BackButton глобальны (один на WebApp). Страницы должны скрывать кнопки при уходе (onUnmounted). Документировать паттерн:
   ```ts
   // На странице:
   const { showMainButton, hideMainButton } = useTelegram()
   onMounted(() => showMainButton('Записаться', onBook))
   onUnmounted(() => hideMainButton())
   ```

## Критерии приёмки

- ✅ Типы TelegramWebApp (что используем)
- ✅ Plugin вызывает ready() + expand() при загрузке
- ✅ useTelegram: isTelegram, colorScheme, MainButton/BackButton/haptics методы
- ✅ Все методы — no-op вне Telegram (graceful)
- ✅ showMainButton избегает дублирующихся onClick (offClick перед onClick)
- ✅ Cleanup паттерн задокументирован (hide в onUnmounted)
- ✅ Браузерный fallback не ломается (isTelegram=false → in-page кнопки)

## Подсказки

- **MainButton/BackButton глобальны** — это главная ловушка. Один инстанс на WebApp. Страница, которая показала MainButton, обязана скрыть при уходе (onUnmounted), иначе кнопка «протечёт» на следующий экран.
- **offClick перед onClick** — Telegram накапливает обработчики, дубли приводят к многократному вызову. Всегда offClick старый перед onClick новый.
- **import.meta.client** — window.Telegram только на клиенте.
- **No-op вне Telegram** — критично для браузерного fallback (8.1.3). В браузере useTelegram методы ничего не делают, страницы используют свои in-page кнопки.

## Не делать

- ❌ Не делать SSR-доступ к window.Telegram
- ❌ Не оставлять MainButton показанной при уходе со страницы
- ❌ Не дублировать onClick обработчики
- ❌ Не типизировать весь WebApp API (только используемое)
