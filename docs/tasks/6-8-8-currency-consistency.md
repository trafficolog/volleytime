---
id: '6.8.8'
phase: '6'
epic: '6.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 6 · P2 #8'
priority: P2
roles:
  - BACK
depends_on: []
estimated_hours: '1'
tags:
  - money
  - review-fix
---

# Task 6.8.8: Валюта события = валюте организации; баланс по валютам

## Цель

Касса не суммирует BYN и RUB в одно число.

## Контекст

Событие могло быть в валюте, отличной от организации; баланс складывал всё.

## Что должно быть сделано

1. `eventService.create/update`: `currency` принудительно из организации (или 422 при расхождении).
2. `ledgerService.getBalance` → `{ byCurrency: { BYN: {income, expense, balance} } }` + основная валюта организации.

## Критерии приёмки

- ✅ Событие в чужой валюте → 422
- ✅ Баланс сгруппирован по валютам

## Подсказки

-

## Не делать

- ❌ Не конвертировать валюты
