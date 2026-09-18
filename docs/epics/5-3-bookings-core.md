---
id: '5.3'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Ядро записи. Capacity + waitlist, atomic slot allocation, concurrency-safe.'
estimated_hours: '8-10'
depends_on: ['5.2']
---

# Epic 5.3: Bookings core (запись, capacity, waitlist)

**Цель.** Реализовать запись игрока на событие с распределением: если есть место (confirmed_count < capacity) → confirmed, иначе → waitlisted. Concurrency-safe через атомарный паттерн.

## Контекст

Это **сердце Phase 5** и самая критичная по корректности часть. Переносим проверенную логику из Python-прототипа, упрощённую до capacity + waitlist (без rotation).

Ключевая сложность — concurrency: последний слот, несколько игроков жмут «записаться» одновременно. Защита: атомарный booking insert + проверка capacity в транзакции, unique (user_id, event_id).

Booking методы (решение 5): в Phase 5 — subscription consume ИЛИ pending_payment. Сама оплата cash/transfer — Phase 6.

## Definition of Done

- Drizzle schema `bookings` с unique (event_id, user_id), статусами, method
- BookingService.book — атомарная транзакция:
  - Проверка: event published, не закрыт, deadline не прошёл
  - Проверка: user является active member org
  - Проверка: user ещё не записан (unique)
  - Определение слота: confirmed (если место есть) или waitlisted
  - Если method=subscription → atomic consume (через subscriptionService, 5.5)
  - Если method=pending → booking в pending_payment, слот занят
- Booking lifecycle: pending_payment / confirmed / waitlisted / attended / no_show / cancelled
- Booking method (backend codes): subscription / cash / transfer / online / free
- Concurrency: capacity не превышается даже при параллельных записях
- listBookingsForEvent (для admin), listMyBookings (для игрока)
- markAttendance (attended/no_show) — owner/organizer
- Все мутации в audit
- Тесты включая race conditions

## Задачи

| ID    | Задача                                               | Часов |
| ----- | ---------------------------------------------------- | ----: |
| 5.3.1 | Schema bookings + миграция                           |     1 |
| 5.3.2 | BookingService.book — allocation (capacity/waitlist) |   3-4 |
| 5.3.3 | Booking statuses + listing (event/my)                |   1-2 |
| 5.3.4 | markAttendance (attended/no_show)                    |     1 |
| 5.3.5 | Concurrency-safe slot allocation + тесты             |     2 |

## Не делать

- ❌ Не делать payment confirm — Phase 6 (booking создаёт pending, не подтверждает оплату)
- ❌ Не делать cancellation здесь — это эпик 5.6
- ❌ Не делать waitlist promotion здесь — это эпик 5.6
- ❌ Не делать уведомления — Phase 8
- ❌ Не делать TTL-отмену pending_payment — Phase 15
