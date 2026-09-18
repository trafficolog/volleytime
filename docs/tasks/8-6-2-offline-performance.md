---
id: '8.6.2'
phase: '8'
epic: '8.6'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11."
roles:
  - FE
depends_on:
  - '8.6.1'
estimated_hours: '1-2'
tags:
  - ui
  - performance
  - mini-app
---

# Task 8.6.2: Offline handling + performance

## Цель

Offline detection (баннер при потере сети). Перформанс открытия Mini App < 2 сек на 4G (профилирование, оптимизация бандла/lazy).

## Контекст

Mini App открывается в мобильном Telegram — сеть нестабильна, важна скорость первого экрана. Offline-баннер и быстрое открытие — релизное качество.

## Что должно быть сделано

1. **Offline detection composable `apps/web/composables/useOnline.ts`:**

   ```ts
   export function useOnline() {
     const online = ref(true)
     if (import.meta.client) {
       online.value = navigator.onLine
       useEventListener(window, 'online', () => {
         online.value = true
       })
       useEventListener(window, 'offline', () => {
         online.value = false
       })
     }
     return { online }
   }
   ```

2. **Offline баннер в layout miniapp:**

   ```vue
   <div
     v-if="!online"
     class="fixed top-0 inset-x-0 bg-orange-500 text-white text-center text-sm py-2 z-50"
   >
     Нет соединения
   </div>
   ```

3. **Performance — профилирование и оптимизация:**
   - Замерить открытие Mini App (Lighthouse / Telegram на 4G throttle)
   - Lazy-load тяжёлых компонентов (sheets, формы) через defineAsyncComponent / dynamic import
   - Проверить размер бандла (`nuxt analyze`), убрать тяжёлое из initial chunk
   - Critical path: auth (8.1.3) + первый экран (список org/событий) должны быть быстрыми
   - Изображения (аватары) — lazy, правильные размеры

4. **Цель < 2 сек:**
   - Initial JS bundle разумного размера (code splitting по роутам — Nuxt делает авто)
   - Не блокировать рендер тяжёлыми запросами (показать skeleton сразу)
   - Prefetch критичных данных

5. **Документировать замеры:**

   ```
   Performance baseline (Phase 8):
   - Mini App cold open: X сек (4G throttle)
   - Target: < 2 сек до интерактивного первого экрана
   - Bundle initial: X KB
   ```

6. **Retry на сетевых ошибках** — при offline→online авто-повтор последнего неудачного запроса (опционально, или ручной retry из 8.6.1 достаточно).

## Критерии приёмки

- ✅ useOnline composable (navigator.onLine + события)
- ✅ Offline баннер в layout (исчезает при восстановлении)
- ✅ Performance замерен (Lighthouse/throttle)
- ✅ Открытие первого экрана < 2 сек на 4G (или задокументировано почему сложно + план)
- ✅ Lazy-load тяжёлых компонентов (sheets, формы)
- ✅ Bundle проанализирован (nuxt analyze)
- ✅ Skeleton показывается мгновенно (не ждёт данных)

## Подсказки

- **Профилировать ДО оптимизации** — не угадывать. Lighthouse в Chrome DevTools с 4G throttle, или реальный телефон.
- **Nuxt авто code-splitting по роутам** — основное уже есть. Фокус на тяжёлых компонентах в initial chunk.
- **Skeleton мгновенно** (8.6.1) — даже если данные грузятся, первый paint быстрый. Воспринимаемая скорость важна.
- **Telegram Mini App кеширует** — повторные открытия быстрее. Cold open — худший случай, его и мерить.
- **< 2 сек — цель, не догма.** Если объективно сложно (медленный VPS в Phase 9) — задокументировать и вынести в Phase 9/10 оптимизацию.

## Не делать

- ❌ Не делать service worker/PWA — после MVP
- ❌ Не оптимизировать вслепую (профилировать)
- ❌ Не кешировать данные агрессивно (свежесть важна для записи/мест)
- ❌ Не блокировать на достижении ровно 2 сек (разумное приближение)
