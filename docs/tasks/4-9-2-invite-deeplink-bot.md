---
id: '4.9.2'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P0 #2'
priority: P0
roles:
  - BACK
depends_on:
  - '3.9.2'
estimated_hours: '1'
tags:
  - invites
  - telegram
  - review-fix
---

# Task 4.9.2: Инвайт-ссылки с именем бота: общий builder + fail-fast

## Цель

Deeplink всегда `https://t.me/<bot>?start=org_<token>`; пустое имя бота не порождает битую ссылку.

## Контекст

`public.telegramBotUsername` был пуст (корневая причина 1) → UI генерировал `https://t.me/?start=org_…`. Маппинг env сделан в 3.9.2; остаётся единый builder и отказ при пустом значении.

## Что должно быть сделано

1. `packages/shared/src/telegram/deeplink.ts`: `buildInviteDeeplink(botUsername, token)` — бросает при пустом username/token; `buildStartParam('org'|'event', value)`.
2. API `invites` (GET/POST) используют builder через `getServerConfig()`; ошибка → 500 `telegram.bot_username_missing`.
3. Юнит-тесты builder.

## Критерии приёмки

- ✅ Ссылка содержит имя бота из `TELEGRAM_BOT_USERNAME`
- ✅ Пустое имя → ошибка, ссылка не отдаётся

## Подсказки

- Telegram ограничивает `start` параметр 64 символами `[A-Za-z0-9_-]`; токен nanoid(16) с префиксом `org_` укладывается.

## Не делать

- ❌ Не собирать ссылку на клиенте
