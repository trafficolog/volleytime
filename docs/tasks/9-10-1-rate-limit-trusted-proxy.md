---
id: '9.10.1'
phase: '9'
epic: '9.10'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Ревью v0.1.1 · Phase 4 / 9 · P1'
priority: P1
roles:
  - SECURITY
  - BACK
depends_on: []
estimated_hours: '1-2'
tags:
  - security
  - rate-limit
  - review2-fix
---

# Task 9.10.1: Лимитер /api/auth/*: адрес соединения вместо произвольного X-Forwarded-For

## Цель

30 запросов с разными значениями `X-Forwarded-For` упираются в лимит так же, как с одного адреса.

## Контекст

Middleware брал первый элемент `X-Forwarded-For` — клиент подделывает заголовок и обходит лимит.

## Что должно быть сделано

1. Ключ лимита: адрес соединения (`event.node.req.socket.remoteAddress`); за доверенным прокси — ПОСЛЕДНИЙ элемент цепочки, и только если `TRUSTED_PROXY=1`.
2. Чистая функция `clientKeyFromRequest` с юнит-тестами (подделка, цепочка, отсутствие заголовка).
3. `.env.prod.example`: `TRUSTED_PROXY=1` для развёртывания за Caddy.

## Критерии приёмки

- ✅ 30 запросов с разными заголовками → 429 после лимита
- ✅ За Caddy лимит считается по реальному адресу клиента, а не по адресу прокси

## Подсказки

- Caddy кладёт реальный адрес последним элементом цепочки.

## Не делать

- ❌ Не доверять заголовку без флага
