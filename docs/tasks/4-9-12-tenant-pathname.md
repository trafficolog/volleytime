---
id: '4.9.12'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P2 #12'
priority: P2
roles:
  - BACK
depends_on: []
estimated_hours: '0.5'
tags:
  - tenant
  - review-fix
---

# Task 4.9.12: Tenant middleware матчит pathname, а не path с query-string

## Цель

`/api/organizations/1?tab=1` разрешает tenant так же, как `/api/organizations/1`.

## Контекст

`event.path` включает query → regex не матчил → `{}` (fail-closed, но хрупко).

## Что должно быть сделано

1. `parseOrgIdFromPath(pathname)` — чистая функция в `server/utils/tenant-path.ts` с тестами.
2. middleware: `getRequestURL(event).pathname`.

## Критерии приёмки

- ✅ Query-string не влияет на разрешение tenant
- ✅ Юнит-тесты парсера

## Подсказки

- `/api/organizations/abc` → 400.

## Не делать

- ❌ Не пропускать нечисловой orgId
