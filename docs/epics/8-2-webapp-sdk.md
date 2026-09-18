---
id: '8.2'
phase: '8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'WebApp SDK обёртка: MainButton/BackButton/theme/haptics поверх страниц 4-6.'
estimated_hours: '5-7'
depends_on: ['8.1']
---

# Epic 8.2: Telegram WebApp SDK (MainButton/BackButton/theme/haptics)

**Цель.** Composable-обёртка над Telegram WebApp SDK. Применить к ключевым flow страниц 4-6: MainButton для главных действий, BackButton, адаптация под тему, haptic feedback.

## Контекст

Решение 1: не переписываем страницы, добавляем Telegram-нативность. Решение 2: MainButton для ключевых действий (запись, оплата, сохранение, подтверждение), BackButton везде, theme params, haptics.

Telegram WebApp SDK (`window.Telegram.WebApp`) даёт: MainButton (нижняя кнопка), BackButton, themeParams, HapticFeedback, expand/close, viewport.

## Definition of Done

- Composable useTelegram() оборачивает WebApp SDK (типобезопасно)
- MainButton: показать/скрыть/текст/loading/onClick — для главного действия экрана
- BackButton: авто-показ на вложенных экранах, навигация назад
- Theme: CSS-переменные из themeParams (адаптация light/dark)
- Haptics: на важных действиях (запись, подтверждение, ошибка)
- WebApp.ready() / expand() при загрузке
- Применено к ключевым flow: BookingSheet (Записаться), payment confirm, EventForm (Сохранить), attendance (Сохранить)
- Graceful degradation: вне Telegram (браузер) — in-page кнопки работают как раньше

## Задачи

| ID    | Задача                                           | Часов |
| ----- | ------------------------------------------------ | ----: |
| 8.2.1 | useTelegram composable + plugin инициализация    |     2 |
| 8.2.2 | MainButton/BackButton интеграция в ключевые flow |   2-3 |
| 8.2.3 | Theme params + haptics                           |   1-2 |

## Не делать

- ❌ Не переписывать страницы (только добавить нативные элементы)
- ❌ Не ломать браузерный fallback (in-page кнопки)
- ❌ Не использовать deprecated WebApp методы
