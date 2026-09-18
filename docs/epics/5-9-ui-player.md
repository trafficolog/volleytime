---
id: '5.9'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'UI игрока. Mini App. На основе паттернов Phase 4 UI + референсов.'
estimated_hours: '8-10'
depends_on: ['5.7']
---

# Epic 5.9: UI player (события, запись, мои записи)

**Цель.** Mini App страницы для игрока: список событий с индикаторами заполненности, страница события с записью (выбор метода через sheet), мои записи с отменой.

## Контекст

Backend (5.1-5.8) готов и протестирован. Этот эпик — UI поверх API. Переиспользуем паттерны Phase 4 UI: composables через useState, Mini App layout, blue primary + orange accent, sheets снизу, confirm для деструктивных действий.

Дизайн-референсы: volleytime.trafficolog.ru (Mini App player flow). Шрифты Space Grotesk + Manrope.

Решения UI-сессии: метод оплаты через sheet с радио (дефолт абонемент); заполнено → кнопка «В лист ожидания» (orange); индикатор «8/12 мест» + прогресс-бар + badge.

## Definition of Done

- `/m/orgs/:orgId/events` — список событий (upcoming/past табы) с индикаторами
- `/m/orgs/:orgId/events/:id` — страница события: детали, заполненность, кнопка записи/waitlist
- Booking sheet: выбор метода (абонемент / оплата на месте), дефолт абонемент
- `/m/orgs/:orgId/my/bookings` — мои записи (upcoming/past), отмена
- Статусы на русском (confirmed=«Записан», waitlisted=«В листе ожидания», pending_payment=«Ждёт оплаты», attended=«Посетил», etc.)
- Loading/empty/error states
- Composables: useEvents, useBookings, useSubscriptions (shared с 5.11)

## Задачи

| ID    | Задача                                               | Часов |
| ----- | ---------------------------------------------------- | ----: |
| 5.9.1 | useEvents composable + список событий с индикаторами |     2 |
| 5.9.2 | Страница события + заполненность                     |     2 |
| 5.9.3 | Booking flow (sheet выбора метода, запись/waitlist)  |   2-3 |
| 5.9.4 | Мои записи + отмена                                  |   1-2 |
| 5.9.5 | Статусы/локализация + shared utilities               |     1 |

## Не делать

- ❌ Не делать payment UI — Phase 6
- ❌ Не делать уведомления — Phase 8
- ❌ Не делать recurring UI — Phase 15
- ❌ Не делать отдельный Web player (переиспользует компоненты)
