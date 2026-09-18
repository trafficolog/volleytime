---
id: '9.10.3'
phase: '9'
epic: '9.10'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Ревью v0.1.1 · Phase 9 · P2'
priority: P2
roles:
  - DEVOPS
  - SECURITY
depends_on: []
estimated_hours: '0.5'
tags:
  - caddy
  - review2-fix
---

# Task 9.10.3: Точный матчер webhook в Caddy

## Цель

Боту уходит только `/tg/webhook/<secret>` (со слэшем на конце — тоже).

## Контекст

Шаблон `…{$WEBHOOK_SECRET_PATH}*` пропускает `/tg/webhook/<secret>EXTRA`.

## Что должно быть сделано

1. Именованный матчер с двумя точными путями: `/tg/webhook/{$WEBHOOK_SECRET_PATH}` и `/tg/webhook/{$WEBHOOK_SECRET_PATH}/`.
2. Проверка конфигурации `caddy validate`.

## Критерии приёмки

- ✅ `<secret>` и `<secret>/` → бот; `<secret>EXTRA` → Nuxt 404

## Подсказки

- secret_token grammY остаётся второй линией защиты.

## Не делать

-
