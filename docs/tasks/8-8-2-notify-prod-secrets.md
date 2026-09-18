---
id: '8.8.2'
phase: '8'
epic: '8.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 8 · P0 #2 (+ P2 #10 секреты)'
priority: P0
roles:
  - BACK
  - SECURITY
depends_on:
  - '3.9.2'
estimated_hours: '1'
tags:
  - notifier
  - bot
  - security
  - review-fix
---

# Task 8.8.2: Уведомления в проде: без дефолтных секретов в боте, fail-fast, constant-time сравнение

## Цель

Web отправляет уведомления в бот по верному адресу и секрету; бот не принимает запросы с дефолтным секретом.

## Контекст

Web читал пустые `botInternalUrl/Secret` (закрыто 3.9.2). Бот имел дефолт `dev-internal-secret` и сравнивал секрет через `!==`.

## Что должно быть сделано

1. `apps/bot/src/env.ts`: в production `BOT_INTERNAL_SECRET`, `TELEGRAM_BOT_TOKEN`, `WEB_URL` обязательны (zod + `NODE_ENV`), дефолты только в dev.
2. `internal-server.ts`: `timingSafeEqual` с выравниванием длины.
3. Notifier web: при ответе ≠ 2xx — лог с кодом, без секрета.
4. Тесты env и сравнения.

## Критерии приёмки

- ✅ Бот в production без секрета не стартует
- ✅ Неверный секрет → 401

## Подсказки

-

## Не делать

- ❌ Не логировать секрет
