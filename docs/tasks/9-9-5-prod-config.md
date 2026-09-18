---
id: '9.9.5'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 9 · P0 #5'
priority: P0
roles:
  - DEVOPS
depends_on:
  - '3.9.2'
estimated_hours: '1'
tags:
  - env
  - docker
  - review-fix
---

# Task 9.9.5: Compose пробрасывает NUXT_* и обязательные переменные

## Цель

Прод-контейнер получает токен бота, имя бота, адрес и секрет бота, публичный URL.

## Контекст

`.env.prod` задавал `TELEGRAM_BOT_TOKEN`, а Nuxt читает `NUXT_*` — в контейнере значения были пустыми.

## Что должно быть сделано

1. `docker-compose.prod.yml`: web получает `NUXT_TELEGRAM_BOT_TOKEN`, `NUXT_BOT_INTERNAL_URL`, `NUXT_BOT_INTERNAL_SECRET`, `NUXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `NUXT_PUBLIC_WEB_URL`, `NUXT_PUBLIC_BETTER_AUTH_URL` из `.env.prod`.
2. `.env.prod.example` синхронизирован и прокомментирован.
3. Fail-fast плагина (3.9.2) проверяется в smoke.

## Критерии приёмки

- ✅ Старт без обязательных переменных → контейнер падает с перечнем

## Подсказки

-

## Не делать

- ❌ Не дублировать секреты в двух местах без комментария
