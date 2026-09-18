---
id: '9.9.3'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 9 · P0 #3'
priority: P0
roles:
  - DEVOPS
depends_on:
  - '9.9.2'
estimated_hours: '0.5'
tags:
  - caddy
  - telegram
  - review-fix
---

# Task 9.9.3: Caddy проксирует webhook без обрезания пути

## Цель

Telegram доставляет апдейты боту.

## Контекст

`handle_path /tg/webhook/*` срезал префикс → бот получал `/` и отвечал 404; апдейты терялись.

## Что должно быть сделано

1. `handle /tg/webhook/*` (без `_path`) + `reverse_proxy bot:8443`.
2. Проверка smoke: POST с неверным `X-Telegram-Bot-Api-Secret-Token` → 401 от бота.

## Критерии приёмки

- ✅ Запрос доходит до бота (не 404)

## Подсказки

-

## Не делать

- ❌ Не публиковать порт бота наружу
