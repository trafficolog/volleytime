---
id: '9.9.11'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 9 · P2 #11'
priority: P2
roles:
  - DEVOPS
  - SECURITY
depends_on:
  - '9.9.5'
estimated_hours: '2'
tags:
  - ops
  - security
  - review-fix
---

# Task 9.9.11: Ротация логов, лимиты памяти, CSP, rate limit для /api/auth/*

## Цель

Прод не забивает диск логами, не падает от утечки памяти и не даёт брутфорсить вход.

## Контекст

Нет ротации логов и лимитов; нет CSP; нет ограничения частоты для входа.

## Что должно быть сделано

1. Compose: `logging: json-file` с `max-size/max-file`, `deploy.resources.limits.memory` для web/bot/postgres.
2. Caddy: security-заголовки и CSP с учётом Telegram (`frame-ancestors https://web.telegram.org https://*.telegram.org`, скрипт `telegram.org`).
3. Rate limit в Nitro для `/api/auth/*` (in-memory, окно/лимит из env) — плагин Caddy не используем, решение зафиксировать в карточке.

## Критерии приёмки

- ✅ 20 попыток входа подряд → 429
- ✅ Mini App открывается в Telegram с включённым CSP

## Подсказки

-

## Не делать

- ❌ Не блокировать по IP надолго — окно минуты
