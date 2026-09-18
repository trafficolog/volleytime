---
id: '8.8.8'
phase: '8'
epic: '8.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 8 · P1 #8'
priority: P1
roles:
  - FE
depends_on:
  - '8.8.3'
estimated_hours: '0.5'
tags:
  - auth
  - routing
  - review-fix
---

# Task 8.8.8: Вне Telegram /m/ без сессии → /auth/login

## Цель

Mini App в обычном браузере не показывает пустой экран.

## Контекст

`/m/` вне Telegram зависал в «Загрузка…».

## Что должно быть сделано

1. `/m/index.vue`: не Telegram → `fetchSession` → есть сессия → стартовый роутинг, нет → `/auth/login?redirect=/m/`.
2. `login.vue` учитывает `redirect`.

## Критерии приёмки

- ✅ Браузер без сессии → экран входа

## Подсказки

-

## Не делать

-
