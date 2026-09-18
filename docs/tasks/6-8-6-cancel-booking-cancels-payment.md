---
id: '6.8.6'
phase: '6'
epic: '6.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 6 · P1 #6'
priority: P1
roles:
  - BACK
depends_on: []
estimated_hours: '0.5-1'
tags:
  - bookings
  - payments
  - review-fix
---

# Task 6.8.6: Отмена брони отменяет её pending-платёж

## Цель

После отмены брони в «Ожидают оплаты» не остаётся её платежа.

## Контекст

Pending-платёж отменённой брони висел в очереди организатора.

## Что должно быть сделано

1. `bookingService.cancel`: если `payment_id` и платёж `pending` → `cancelled` (условный UPDATE).
2. Succeeded-платёж при отмене игроком не возвращается автоматически (решение организатора) — фиксируем в карточке.
3. Тест.

## Критерии приёмки

- ✅ Отмена брони → платёж `cancelled`

## Подсказки

-

## Не делать

- ❌ Не делать автоматический возврат оплаченного
