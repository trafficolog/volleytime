---
id: '8.8.3'
phase: '8'
epic: '8.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 8 · P1 #3'
priority: P1
roles:
  - FE
  - BACK
depends_on:
  - '8.8.1'
estimated_hours: '2'
tags:
  - telegram
  - routing
  - review-fix
---

# Task 8.8.3: Стартовый роутер /m/: вход → start_param → последняя организация

## Цель

Открытие Mini App по кнопке бота ведёт в нужный экран.

## Контекст

`/m/` после входа всегда вёл в список; `start_param` игнорировался; бот не передавал контекст в кнопку.

## Что должно быть сделано

1. `resolveStartParam(param)` (shared): `org_<token>` → `/m/invite/<token>`, `event_<id>` → резолвер `GET /api/events/:id/locate` → `/m/orgs/:orgId/events/:id`.
2. `/m/index.vue`: Telegram → `authenticate()` → `start_param` (`initDataUnsafe.start_param` или `?tgWebAppStartParam`) → последняя организация (`localStorage`) → `/m/orgs`.
3. API `GET /api/events/:id/locate` — `{ orgId }` только для участников организации события.
4. Бот: кнопка Mini App с `startapp`/URL `?startapp=` для контекста.

## Критерии приёмки

- ✅ `event_12` открывает событие 12 у участника, чужому — список групп
- ✅ `org_<token>` открывает экран приглашения

## Подсказки

-

## Не делать

- ❌ Не раскрывать orgId события не-участнику
