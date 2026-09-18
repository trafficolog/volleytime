---
id: '4.9.10'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P1 #10'
priority: P1
roles:
  - BACK
depends_on: []
estimated_hours: '0.5'
tags:
  - organizations
  - review-fix
---

# Task 4.9.10: Архивная организация исчезает из списка

## Цель

Закрыть DoD 12: `GET /organizations` не возвращает `archived`.

## Контекст

`listForUser` фильтровал только membership.

## Что должно быть сделано

1. `listForUser`: join organizations `status <> archived`.
2. Тест: archive → список без неё.

## Критерии приёмки

- ✅ После архивации организации нет в списке

## Подсказки

- suspended показываем (с пометкой) — владелец должен видеть блокировку.

## Не делать

- ❌ Не удалять организацию физически
