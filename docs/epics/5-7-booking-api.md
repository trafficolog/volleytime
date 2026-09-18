---
id: '5.7'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'API endpoints для booking/subscription операций игрока.'
estimated_hours: '4-5'
depends_on: ['5.3', '5.5', '5.6']
---

# Epic 5.7: Booking/subscription API endpoints

**Цель.** Собрать API endpoints для всех player-facing операций: записаться, отменить, мои записи, купить абонемент, мои абонементы.

## Контекст

Сервисы (5.3, 5.5, 5.6) уже содержат логику. Этот эпик — тонкие HTTP-обёртки с правильными permissions, error handling, response shaping.

Все под tenant middleware (`/api/organizations/:orgId/*`), кроме это player-операции (требуют active membership, не owner).

## Definition of Done

- POST `/api/organizations/:orgId/events/:eventId/book` — записаться. Body: { method, subscriptionId? }
- DELETE `/api/organizations/:orgId/bookings/:bookingId` — отменить свою бронь
- GET `/api/organizations/:orgId/my/bookings` — мои записи (фильтр upcoming/past)
- GET `/api/organizations/:orgId/events/:eventId/bookings` — список записей события (owner/organizer)
- PATCH `/api/organizations/:orgId/bookings/:bookingId/attendance` — отметить attended/no_show (owner/organizer)
- POST `/api/organizations/:orgId/subscriptions` — получить абонемент (createFromPlan). Body: { planId }
- GET `/api/organizations/:orgId/my/subscriptions` — мои абонементы
- Все ошибки маппятся в HTTP статусы через handle-errors
- Permissions: book/cancel — active member; attendance/event bookings list — owner/organizer
- Error codes для всех edge cases (event closed, deadline passed, no spots logic→waitlist, already booked, subscription exhausted)

## Задачи

| ID    | Задача                                                 | Часов |
| ----- | ------------------------------------------------------ | ----: |
| 5.7.1 | Booking endpoints (book, cancel, my, list, attendance) |     2 |
| 5.7.2 | Subscription endpoints (buy, my)                       |     1 |
| 5.7.3 | Error handling + permission integration                |   1-2 |

## Не делать

- ❌ Не делать UI — это эпики 5.9-5.11
- ❌ Не делать payment endpoints — Phase 6
- ❌ Не делать bulk booking (записать несколько) — Phase 14+
- ❌ Не делать booking на чужое имя (guest booking) — Phase 14+
