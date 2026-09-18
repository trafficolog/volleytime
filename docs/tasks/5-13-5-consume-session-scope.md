---
id: '5.13.5'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P0 #5'
priority: P0
roles:
  - BACK
  - SECURITY
depends_on: []
estimated_hours: '1'
tags:
  - subscriptions
  - security
  - review-fix
---

# Task 5.13.5: Списание абонемента: организация и срок в обеих ветках

## Цель

Абонемент одной организации нельзя использовать в другой; истёкший не списывается.

## Контекст

При явном `subscriptionId` `consumeSession` проверял только userId и статус.

## Что должно быть сделано

1. Единое условие для обеих веток: `user_id`, `organization_id = orgId`, `status = active`, `used < total`, `expires_at IS NULL OR > now()` — и в поиске кандидата, и в атомарном UPDATE.
2. Тест: абонемент орг. A при записи на событие орг. B → 409 `subscription.no_active`; истёкший → 409.

## Критерии приёмки

- ✅ Кросс-организационное списание невозможно
- ✅ Истёкший абонемент не списывается

## Подсказки

- Условия срока дублируются в UPDATE — защита от гонки с истечением.

## Не делать

- ❌ Не полагаться на выбор абонемента в UI
