---
id: '5.12.2'
phase: '5'
epic: '5.12'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - QA
  - FE
depends_on:
  - '5.12.1'
  - '5.9.5'
estimated_hours: '1-2'
tags:
  - tests
  - ui
  - smoke
  - regression
---

# Task 5.12.2: UI smoke + регрессия

## Цель

Sanity-проверка ключевых UI-компонентов Phase 5 (рендерятся без ошибок, базовая логика props). Подтверждение что регрессии нет: Phase 4 и Phase 5 backend тесты зелёные.

## Контекст

Vue Test Utils не настраивался в Phase 3 (отложен). В Phase 5 — минимальный smoke-уровень для критичных компонентов с чистой логикой (EventCapacityBar, labels utils). Полноценное компонентное/E2E тестирование — Phase 9.

## Что должно быть сделано

1. **Настроить Vue Test Utils (если ещё нет):**

   ```bash
   pnpm -F @volley-time/web add -D @vue/test-utils @testing-library/vue happy-dom
   ```

   В `vitest.config.ts` web — добавить environment happy-dom для `.vue.test.ts`.

2. **Smoke `apps/web/components/__tests__/EventCapacityBar.test.ts`:**

   ```ts
   import { describe, test, expect } from 'vitest'
   import { mount } from '@vue/test-utils'
   import EventCapacityBar from '../EventCapacityBar.vue'

   describe('EventCapacityBar', () => {
     test('renders count', () => {
       const w = mount(EventCapacityBar, {
         props: { confirmedCount: 8, capacity: 12, waitlistCount: 0 },
       })
       expect(w.text()).toContain('8/12')
       expect(w.text()).toContain('Есть места')
     })
     test('shows waitlist badge when full', () => {
       const w = mount(EventCapacityBar, {
         props: { confirmedCount: 12, capacity: 12, waitlistCount: 3 },
       })
       expect(w.text()).toContain('Лист ожидания')
       expect(w.text()).toContain('3')
     })
     test('fill percent capped at 100', () => {
       const w = mount(EventCapacityBar, {
         props: { confirmedCount: 15, capacity: 12, waitlistCount: 0 },
       })
       const bar = w.find('[style*="width"]')
       expect(bar.attributes('style')).toContain('100%')
     })
   })
   ```

3. **Unit `apps/web/utils/__tests__/labels.test.ts`:**

   ```ts
   import { describe, test, expect } from 'vitest'
   import { label, errorMessage, plural, BOOKING_STATUS_LABELS } from '../labels'

   describe('labels', () => {
     test('booking status label', () => {
       expect(label(BOOKING_STATUS_LABELS, 'confirmed')).toBe('Записан')
       expect(label(BOOKING_STATUS_LABELS, 'unknown')).toBe('unknown') // fallback
     })
     test('errorMessage known code', () => {
       expect(errorMessage('booking.already_booked')).toContain('уже записаны')
     })
     test('errorMessage fallback', () => {
       expect(errorMessage('xxx', 'дефолт')).toBe('дефолт')
     })
     test('plural sessions', () => {
       expect(plural(1, ['занятие', 'занятия', 'занятий'])).toBe('занятие')
       expect(plural(2, ['занятие', 'занятия', 'занятий'])).toBe('занятия')
       expect(plural(5, ['занятие', 'занятия', 'занятий'])).toBe('занятий')
       expect(plural(11, ['занятие', 'занятия', 'занятий'])).toBe('занятий')
       expect(plural(21, ['занятие', 'занятия', 'занятий'])).toBe('занятие')
     })
   })
   ```

4. **Smoke формат-функций `useFormatters`:**

   ```ts
   test('formatPrice: 0 → Бесплатно, иначе X.XX', () => {
     // formatPrice не composable-зависим — вынести логику или тестировать через wrapper
     // alternativ: проверить (1500/100).toFixed(2) === '15.00'
   })
   ```

   Если formatPrice внутри composable, для теста вынести чистую функцию в utils или тестировать через mount компонента-обёртки.

5. **Регрессия — прогон всех тестов:**

   ```bash
   pnpm test  # все пакеты
   # Ожидаем: Phase 3 (smoke), Phase 4 (flows/security/race),
   # Phase 5 backend (5.8.x), Phase 5 lifecycle (5.12.1) — все зелёные
   ```

6. **Документировать охват:**
   ```
   Phase 5 UI testing scope (Phase 5):
   - Pure logic: labels, formatters, EventCapacityBar — unit/smoke ✓
   - Full lifecycle: через сервисы (5.12.1) ✓
   - Interactive components (BookingSheet, EventForm): manual testing в Mini App
   - Full E2E (browser): отложено до Phase 9
   ```

## Критерии приёмки

- ✅ Vue Test Utils настроен (happy-dom environment)
- ✅ EventCapacityBar: рендер count, waitlist badge, fill cap 100% — тесты проходят
- ✅ labels: label fallback, errorMessage, plural (склонения) — проходят
- ✅ Регрессия: вся тестовая база зелёная (Phase 3/4/5)
- ✅ Охват UI-тестирования задокументирован
- ✅ Чёткое разделение: что покрыто авто, что manual, что отложено в Phase 9

## Подсказки

- **Smoke ≠ полное покрытие.** Цель — поймать грубые поломки (компонент не монтируется, props игнорируются). Глубокое UI-тестирование — Phase 9 с Playwright.
- **Чистые функции легче всего:** labels, plural, formatPrice — тестируются без mount. Приоритет им.
- **Interactive components (BookingSheet)** — сложны для unit (sheet, emit, API). Manual в Mini App дешевле сейчас. E2E — Phase 9.
- **Если Vue Test Utils тяжело завести** — минимум сделать unit на labels/formatters (чистая логика), компонентные отложить. Не блокироваться.

## Не делать

- ❌ Не делать E2E браузерные тесты — Phase 9
- ❌ Не гнаться за 100% UI coverage — sanity достаточно
- ❌ Не тестировать сторонние (Nuxt routing, $fetch) — наш код
- ❌ Не мокать весь API для компонентных тестов — overkill для Phase 5
