---
id: '9.9.6'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 9 · P1 #6'
priority: P1
roles:
  - DEVOPS
  - BACK
depends_on: []
estimated_hours: '2'
tags:
  - observability
  - review-fix
---

# Task 9.9.6: Sentry в web и боте (включается при наличии DSN)

## Цель

Ошибки прода видны без ssh.

## Контекст

`SENTRY_DSN` был в примерах, но ничего не инициализировалось.

## Что должно быть сделано

1. Web: `@sentry/nuxt` (или nitro-плагин `@sentry/node`) — init только при DSN, `environment`, `release`.
2. Бот: `@sentry/node` + `captureException` в `bot.catch` и в internal-сервере.
3. Трассировка отключена (`tracesSampleRate: 0`), PII не отправляем.

## Критерии приёмки

- ✅ Без DSN приложение работает как раньше
- ✅ С DSN тестовая ошибка уходит в Sentry

## Подсказки

-

## Не делать

- ❌ Не отправлять initData и секреты
