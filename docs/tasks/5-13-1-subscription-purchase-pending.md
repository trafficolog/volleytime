---
id: '5.13.1'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P0 #1'
priority: P0
roles:
  - BACK
  - SECURITY
depends_on: []
estimated_hours: '2'
tags:
  - subscriptions
  - payments
  - review-fix
---

# Task 5.13.1: Покупка абонемента: pending + платёж, без autoActivate

## Цель

Игрок больше не получает активный абонемент бесплатно нажатием «Получить».

## Контекст

`POST /subscriptions` вызывал `createFromPlan(…, {autoActivate: true})`: `status: active`, платежей 0, сразу запись с него.

## Что должно быть сделано

1. `subscriptionService.purchase(ctx, orgId, planId, { method })` в транзакции:
   - план активен и принадлежит организации;
   - `price > 0` → подписка `pending` + `paymentService.createForSubscription` (cash/transfer);
   - `price = 0` → `activate` сразу (DoD 8 Phase 6).
2. API `POST /subscriptions` принимает `{ planId, method: 'cash'|'transfer' }` (zod), вызывает `purchase`; `autoActivate` из API удалён.
3. Нельзя купить второй pending по тому же плану, пока первый не оплачен/отменён (409 `subscription.pending_exists`).

## Критерии приёмки

- ✅ Платный план → `pending`, 1 pending-платёж на сумму плана
- ✅ Запись «с абонемента» по pending-абонементу → 409 `subscription.no_active`
- ✅ Бесплатный план → `active` сразу

## Подсказки

- Подтверждение оплаты и активация со сроком — 6.8.3.

## Не делать

- ❌ Не активировать абонемент на клиентском действии
