---
id: '6.3'
phase: '6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Замыкание заглушек Phase 5: booking confirm, subscription activation по оплате.'
estimated_hours: '3-4'
depends_on: ['6.1', '5.3', '5.5']
---

# Epic 6.3: Payment integration (booking confirm, subscription activation)

**Цель.** Подключить Payment к flow Phase 5: cash/transfer booking создаёт Payment, покупка платного абонемента создаёт Payment (без autoActivate), confirm активирует.

## Контекст

Phase 5 оставила заглушки: cash/transfer booking создавал pending_payment без Payment-записи; платный subscription активировался autoActivate. Phase 6 替换 это реальными Payment.

Решение 10: autoActivate только для price=0; платные → через payment.

## Definition of Done

- bookingService.book (method cash/transfer) → создаёт Payment(pending) через paymentService, связывает booking.payment_id
- subscriptionService.createFromPlan: если plan.price > 0 → Payment(pending), subscription pending (без autoActivate); если price=0 → autoActivate как раньше
- API subscription buy (5.7.2) убирает autoActivate=true для платных
- paymentService.confirm активирует соответствующую сущность
- Обратная совместимость: free booking / free plan работают как в Phase 5
- Integration тесты flow

## Задачи

| ID    | Задача                                             | Часов |
| ----- | -------------------------------------------------- | ----: |
| 6.3.1 | Booking → Payment integration (cash/transfer)      |   1-2 |
| 6.3.2 | Subscription → Payment integration (платные планы) |   1-2 |

## Не делать

- ❌ Не ломать free flow (price=0 остаётся autoActivate/free)
- ❌ Не делать online — Phase 12
- ❌ Не делать UI — эпики 6.5/6.6
