---
id: '9.9.10'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 9 · P2 #10'
priority: P2
roles:
  - DEVOPS
  - BACK
depends_on:
  - '9.9.4'
estimated_hours: '1-2'
tags:
  - bot
  - docker
  - review-fix
---

# Task 9.9.10: Бот: health-эндпоинт, ретраи старта, drop_pending_updates=false, прод-образ на JS

## Цель

Бот наблюдаем, переживает недоступность БД/Telegram при старте и не теряет апдейты.

## Контекст

Нет health, при недоступности Telegram процесс падал, апдейты дропались, прод запускался через `tsx`.

## Что должно быть сделано

1. `GET /healthz` на internal-сервере: `{ status, mode, uptime }`.
2. Ретраи `bot.init()`/webhook с экспоненциальной паузой (5 попыток).
3. `drop_pending_updates: false` при регистрации webhook.
4. Dockerfile бота: сборка `tsc`/`tsup` → `node dist/index.js`; healthcheck в compose.

## Критерии приёмки

- ✅ `/healthz` → 200
- ✅ Прод-образ не содержит tsx

## Подсказки

-

## Не делать

-
