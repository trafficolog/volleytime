---
id: '5.5'
phase: '5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Купленные абонементы. Atomic consume, FIFO по expires_at.'
estimated_hours: '6-8'
depends_on: ['5.4']
---

# Epic 5.5: Subscriptions (consume, FIFO)

**Цель.** Реализовать `Subscription` — купленный игроком абонемент. Атомарное списание сессии при записи на событие, FIFO-выбор по сроку истечения.

## Контекст

Это вторая по критичности часть после bookings. Переносим из прототипа атомарный consume и FIFO-логику.

Решение 9: `UPDATE SET used = used + 1 WHERE used < total RETURNING`. Решение 10: FIFO по expires_at. Решение 12: subscription создаётся pending, активируется при оплате (Phase 6); в dev можно сразу active.

## Definition of Done

- Drizzle schema `subscriptions`: plan_id, user_id, org_id, total_sessions, used_sessions, status, expires_at, purchased_at
- Subscription status: pending → active → exhausted / expired / cancelled
- SubscriptionService:
  - createFromPlan (status=pending, expires_at рассчитывается из validity_days при активации)
  - activate (pending → active, устанавливает expires_at) — вызывается при оплате (Phase 6) или сразу в dev
  - consumeSession (atomic, FIFO selection) — возвращает какой subscription списан
  - restoreSession (atomic, used -= 1) — при отмене брони
  - listActiveForUser
- consumeSession: выбирает active subscription с наименьшим expires_at, где used < total, атомарно инкрементит
- Если used достигает total → status=exhausted
- Expiry check: expired subscriptions не используются для consume
- Audit + тесты включая concurrency (нельзя списать больше total)

## Задачи

| ID    | Задача                                   | Часов |
| ----- | ---------------------------------------- | ----: |
| 5.5.1 | Schema subscriptions + миграция          |     1 |
| 5.5.2 | SubscriptionService create + activate    |   1-2 |
| 5.5.3 | consumeSession atomic + FIFO selection   |   2-3 |
| 5.5.4 | restoreSession + expiry handling + тесты |     2 |

## Не делать

- ❌ Не делать payment integration (активация по оплате) — структура готова, подключение в Phase 6
- ❌ Не делать transfer subscription между игроками
- ❌ Не делать freeze/pause абонемента — Phase 14+
- ❌ Не делать refund сессий деньгами — Phase 6+
