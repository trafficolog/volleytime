---
id: '4.9.11'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P2 #11 (+ Phase 5 · P2 #14 ZodError)'
priority: P2
roles:
  - BACK
  - SECURITY
depends_on: []
estimated_hours: '1-2'
tags:
  - api
  - errors
  - review-fix
---

# Task 4.9.11: Ошибки валидации → 422 без дампов zod/SQL во всех хендлерах

## Цель

Никакой хендлер не отдаёт 500 с телом zod/SQL на невалидный ввод.

## Контекст

create org `{name:"x"}` → 500; `?statuses=foo` → 500 с текстом SQL. `handleServiceError` вызывался не везде, ZodError отдавался целиком.

## Что должно быть сделано

1. `defineApiHandler(fn)` — обёртка с единым catch → `handleServiceError`.
2. `handleServiceError`: ZodError → 422 `{ code: 'validation_failed', issues: [{path, message}] }`; неизвестные ошибки → 500 «Внутренняя ошибка» без stack/SQL (лог на сервере).
3. `statuses` — `z.array(z.enum(memberStatuses))`.
4. Все роуты `organizations/**`, `invites/**` переведены на обёртку.

## Критерии приёмки

- ✅ `{name:'x'}` → 422 с `issues`
- ✅ `?statuses=foo` → 422, в теле нет SQL

## Подсказки

- Проверка: `grep -L defineApiHandler server/api/**` → только auth/health.

## Не делать

- ❌ Не отдавать `e.message` неизвестных ошибок клиенту
