---
id: '9.9.2'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 9 · P0 #2'
priority: P0
roles:
  - DEVOPS
  - QA
depends_on:
  - '9.9.1'
estimated_hours: '2'
tags:
  - smoke
  - deploy
  - review-fix
---

# Task 9.9.2: Smoke: health c проверкой БД и auth, авторизованный запрос, webhook

## Цель

Деплой считается успешным только если вход и авторизованный API работают.

## Контекст

Smoke дергал `/api/health` — он был бы зелёным при полностью сломанном входе.

## Что должно быть сделано

1. `/api/health`: проверка БД (`select 1`) и таблиц better-auth (`verifications`), версия релиза; 503 при сбое.
2. `scripts/smoke.mjs`: health → `get-session` 200 → при наличии `SMOKE_BOT_TOKEN`/`SMOKE_TG_ID` подписывает initData, входит, дергает `/api/organizations` → webhook с неверным секретом → 401/403 (не 404).
3. Deploy-workflow вызывает smoke и падает при ошибке.

## Критерии приёмки

- ✅ Smoke ловит сломанный вход (проверено на v0.1.0-подобной поломке)

## Подсказки

- Smoke-пользователь — отдельный Telegram id, помечен в БД.

## Не делать

- ❌ Не хранить smoke-токен в репозитории
