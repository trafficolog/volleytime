---
id: '8.8.1'
phase: '8'
epic: '8.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 8 · P0 #1'
priority: P0
roles:
  - FE
depends_on: []
estimated_hours: '1'
tags:
  - telegram
  - miniapp
  - review-fix
---

# Task 8.8.1: SDK telegram-web-app.js в head; isTelegram по initData

## Цель

Mini App видит `window.Telegram.WebApp` и выполняет вход по initData.

## Контекст

Скрипт SDK не подключался — `window.Telegram` undefined, вход в Telegram не работал.

## Что должно быть сделано

1. `app.head.script`: `https://telegram.org/js/telegram-web-app.js` (без `defer`, до гидратации).
2. `useTelegram`: `tg` читается лениво; `isTelegram = !!tg?.initData` (в обычном браузере SDK есть, но initData пуст); `ready()`/`expand()` на старте.
3. Юнит-тест детектора на моках window.

## Критерии приёмки

- ✅ В Telegram `isTelegram === true`, в браузере — false

## Подсказки

- CSP (9.9.11) должен разрешать telegram.org.

## Не делать

- ❌ Не подключать SDK пакетом npm — Telegram требует официальный скрипт
