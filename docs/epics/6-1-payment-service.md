---
id: '6.1'
phase: '6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Payment polymorphic. Ядро финансового контура.'
estimated_hours: '6-8'
depends_on: ['5.3', '5.5']
---

# Epic 6.1: Payment service (schema, create, confirm, cancel, refund)

**Цель.** Модель `Payment` (polymorphic: booking_id ИЛИ subscription_id) и сервис: создание pending, подтверждение (succeeded + side effects), отклонение (cancelled), возврат (refunded). Append-only.

## Контекст

Payment — центральная финансовая сущность. Создаётся при cash/transfer booking (5.3) и при покупке платного абонемента (5.5). Подтверждение организатором замыкает контур: деньги фиксируются, booking/subscription активируются.

Решение 1: polymorphic — ровно одно из booking_id/subscription_id. Решение 2: lifecycle pending → succeeded/cancelled/refunded. Решение 4: confirm атомарно, проверка состояния booking.

## Definition of Done

- Drizzle schema `payments` (polymorphic, статусы, метод, сумма)
- PaymentService: createForBooking, createForSubscription, confirm, cancel, refund, listPending
- confirm: атомарно Payment→succeeded + side effect (booking→confirmed / subscription→active) + LedgerEntry income (через 6.2)
- confirm с booking не в pending_payment → payment succeeded, booking не трогаем
- cancel (reject): Payment→cancelled, booking→cancelled (+ promotion через 5.6)
- refund: Payment→refunded + LedgerEntry expense (refund категория)
- Append-only: refund не меняет succeeded, создаёт связь
- Permission: confirm/cancel/refund — owner/organizer

## Задачи

| ID    | Задача                                           | Часов |
| ----- | ------------------------------------------------ | ----: |
| 6.1.1 | Schema payments + миграция                       |     1 |
| 6.1.2 | PaymentService create (booking/subscription)     |   1-2 |
| 6.1.3 | PaymentService confirm (атомарно + side effects) |   2-3 |
| 6.1.4 | PaymentService cancel + refund                   |   1-2 |

## Не делать

- ❌ Не делать online payment (bePaid) — Phase 12
- ❌ Не делать частичную оплату/рассрочку
- ❌ Не редактировать succeeded payment (append-only)
- ❌ Не делать UI — эпик 6.5
