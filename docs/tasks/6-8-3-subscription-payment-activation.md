---
id: '6.8.3'
phase: '6'
epic: '6.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 6 · P0 #3 (+ DoD 7/8)'
priority: P0
roles:
  - BACK
depends_on:
  - '6.8.1'
estimated_hours: '1-2'
tags:
  - subscriptions
  - payments
  - review-fix
---

# Task 6.8.3: Подтверждение оплаты абонемента активирует со сроком; отклонение отменяет pending-абонемент

## Цель

Оплаченный абонемент активен со сроком `validityDays` плана; бесплатный активируется сразу (5.13.1).

## Контекст

`confirm` ставил `status: active` без `expiresAt` — абонемент становился бессрочным. Создание pending + платёж закрыто в 5.13.1.

## Что должно быть сделано

1. `confirm` для `subscriptionId`: `expiresAt = now + plan.validityDays`, `WHERE status = 'pending'`; audit `subscription.activated`.
2. `reject`: pending-абонемент → `cancelled` (только если pending).
3. Тесты DoD 7 (платный → pending → confirm → active со сроком) и DoD 8 (бесплатный → active).

## Критерии приёмки

- ✅ `expiresAt` = дата подтверждения + validityDays
- ✅ Отклонение не трогает уже активный абонемент

## Подсказки

- Срок считаем от подтверждения, не от покупки.

## Не делать

- ❌ Не импортировать subscriptionService в payments (цикл) — прямой UPDATE
