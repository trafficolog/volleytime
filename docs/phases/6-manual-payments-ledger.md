---
id: '6'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: 'Финансовый контур. Payment (polymorphic) + Ledger + mass refund. Уведомления → Phase 8.'
estimated_hours: '20-30'
depends_on: ['5']
---

# Phase 6: Manual Payments + Ledger

**Цель.** Финансовый контур организации: ручная фиксация и подтверждение оплат (наличные/перевод), касса с балансом и историей, автоматический mass refund при отмене события. Подключает то, что Phase 5 оставила заглушками (pending_payment → confirmed, активация платных абонементов).

## Контекст

После Phase 5 booking с cash/transfer создаёт `pending_payment` (слот занят, но оплата не подтверждена), а платный subscription активировался через autoActivate-заглушку. Phase 6 замыкает финансовый контур: организатор подтверждает оплату → booking становится confirmed / subscription активируется, деньги фиксируются в кассе.

Деньги требуют точности. Принцип из DOMAIN: **append-only для Payment и LedgerEntry** — записи никогда не редактируются, корректировки только через новые (сторнирующие/refund) записи.

## Предусловия

- ✅ Phase 5 завершена: events, bookings (pending_payment), subscriptions (autoActivate-заглушка)
- ✅ booking.payment_id и booking.subscription_id поля существуют (5.3.1)
- ✅ subscriptionService.activate готов к вызову при оплате (5.5.2)
- ✅ eventService.cancel имеет заглушку «mass refund — Phase 6» (5.2.2)

## Definition of Done

1. ✅ Payment (polymorphic: booking_id ИЛИ subscription_id) создаётся при cash/transfer booking и при покупке платного абонемента
2. ✅ Payment lifecycle: pending → succeeded / cancelled / refunded
3. ✅ Owner/organizer видит список pending-платежей, подтверждает одним действием
4. ✅ Confirm атомарно: Payment → succeeded, booking → confirmed (или subscription → active), LedgerEntry income создаётся
5. ✅ Если booking к моменту confirm уже не pending_payment — payment всё равно succeeded, booking не трогаем (деньги получены)
6. ✅ Reject (cancel) pending-платежа: Payment → cancelled, booking → cancelled (слот освобождается, promotion)
7. ✅ Платный subscription больше не autoActivate — создаётся pending, активируется при confirm оплаты
8. ✅ Бесплатный план (price=0) активируется сразу (autoActivate сохраняется только для бесплатных)
9. ✅ Касса: баланс (SUM income − SUM expense), история операций, добавление расходов
10. ✅ LedgerEntry с категориями (enum + description), трассировка (payment_id/event_id)
11. ✅ Отмена события организатором → mass refund: restore сессий + refund succeeded payments (ledger expense) + cancel pending
12. ✅ Игрок отменяет оплаченную бронь сам → booking cancelled, деньги остаются (ledger не трогаем, возврат — ручное решение через кассу)
13. ✅ UI: pending payments confirm (admin), касса (баланс/история/расходы)
14. ✅ Все суммы — русскоязычные статусы/категории в UI
15. ✅ ≥ 15 тестов (payment confirm/cancel/refund, ledger balance, mass refund)

## Архитектура Phase 6

### Новые модели

```
packages/db/src/schema/
├── payments.ts        # ★ polymorphic (booking_id | subscription_id)
└── ledger-entries.ts  # ★ income/expense с категориями
```

### Новые модули

```
apps/web/modules/
├── payments/          # create, confirm, cancel, refund
└── ledger/            # entry create, balance, history
```

### Интеграция с Phase 5

```
bookingService.book (cash/transfer)  → создаёт Payment(pending)
subscriptionService.createFromPlan   → если price>0: Payment(pending), без autoActivate
paymentService.confirm               → booking→confirmed / subscription→active + LedgerEntry
paymentService.cancel                → booking→cancelled (+ promotion)
eventService.cancel                  → mass refund (заглушка из 5.2.2 реализуется)
```

### API endpoints

```
/api/organizations/:orgId/payments              GET (pending list)
/api/organizations/:orgId/payments/:id/confirm  POST
/api/organizations/:orgId/payments/:id/cancel   POST
/api/organizations/:orgId/ledger                GET (history + balance)
/api/organizations/:orgId/ledger/expense        POST (добавить расход)
```

## Эпики

| ID                                   | Эпик                                                           | Задач | Часов |
| ------------------------------------ | -------------------------------------------------------------- | ----: | ----: |
| 6.1                                  | Payment service (schema, create, confirm, cancel, refund)      |     4 |   6-8 |
| 6.2                                  | Ledger service (schema, entry, balance, history)               |     3 |   4-5 |
| 6.3                                  | Payment integration (booking confirm, subscription activation) |     2 |   3-4 |
| 6.4                                  | Mass refund при отмене события                                 |     2 |   3-4 |
| 6.5                                  | UI admin: pending payments + confirm/reject                    |     2 |   3-4 |
| 6.6                                  | UI: касса (баланс, история, расходы)                           |     2 |   3-4 |
| 6.7                                  | Tests                                                          |     3 |   4-5 |
| [6.8](../epics/6-8-review-fixes.md)  | **Исправления по ревью v0.1.0**                                |    12 | 22-30 |
| [6.9](../epics/6-9-review2-fixes.md) | **Исправления по повторному ревью v0.1.1**                     |     1 |     1 |

**Итого:** 7 эпиков, ~18 задач, 20-30 часов.

## Технические заметки

### Утверждённые решения

1. **Payment polymorphic** — nullable booking_id И subscription_id, ровно одно заполнено
2. **Payment lifecycle:** pending → succeeded / cancelled / refunded. Русские названия в UI
3. **Confirm: owner + organizer** (assistant — когда роль заработает)
4. **Confirm атомарно;** если booking уже не pending_payment — payment succeeded, booking не трогаем
5. **LedgerEntry:** type + amount + category + nullable payment_id/event_id + description
6. **Категории enum + description:** payment_income, rent, equipment, refund, salary, other
7. **Баланс через SUM** (income − expense), не денормализуется
8. **Mass refund при отмене события автоматический:** restore сессий + refund succeeded + cancel pending
9. **Игрок-отмена оплаченной брони:** booking cancelled, ledger не трогаем, возврат — ручное решение организатора через кассу
10. **autoActivate только для бесплатных планов** (price=0); платные → через payment confirm
11. **Уведомления отложены на Phase 8** (bot ещё нет)
12. **Вся фаза за раз** (backend + UI)

### Что НЕ делаем в Phase 6

- ❌ Уведомления (pending created, confirmed/rejected) — Phase 8 (bot)
- ❌ Онлайн-оплаты (bePaid) — Phase 12
- ❌ Двойная бухгалтерская запись (debit/credit) — простой ledger достаточно
- ❌ Денормализованный баланс — SUM по запросу
- ❌ Автоматический refund при self-cancel игрока (ручное решение организатора)
- ❌ Полноценные финансовые отчёты/экспорт — Phase 14
- ❌ Налоговая отчётность — Phase 14 + Трек A (юридическое)
- ❌ Event credits (платформенная монетизация) — Phase 7

### Что переносим из Python-прототипа

- Payment.confirm как single source of truth (подтверждение → деньги + статусы)
- LedgerService с категориями
- Refund flow при отмене тренировки (mass refund)

## Ссылки

- [DOMAIN.md](../DOMAIN.md) — Payment, LedgerEntry, append-only принцип
- [5-events-bookings-subscriptions.md](./5-events-bookings-subscriptions.md) — что оставлено заглушками
- [BILLING_AND_ENTITLEMENTS.md](../strategy/BILLING_AND_ENTITLEMENTS.md)
- [TAXES.md](../guides/TAXES.md) — РБ/РФ контекст для Трека A
