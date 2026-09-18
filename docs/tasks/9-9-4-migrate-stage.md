---
id: '9.9.4'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 9 · P0 #4'
priority: P0
roles:
  - DEVOPS
  - DB
depends_on: []
estimated_hours: '1'
tags:
  - docker
  - migrations
  - review-fix
---

# Task 9.9.4: Стадия миграций: отдельный образ, падение останавливает деплой

## Цель

Ошибка миграции видна и останавливает выкладку.

## Контекст

`command: sh -c "pnpm db:migrate || echo ..."` в образе web: инструментов нет, ошибка маскировалась.

## Что должно быть сделано

1. Стадия `migrator` в Dockerfile (tsx + пакет db) или отдельный образ; compose-сервис `migrate` без `|| echo`, `restart: no`.
2. Deploy: `docker compose run --rm migrate` с проверкой кода возврата до старта web/bot.

## Критерии приёмки

- ✅ Ошибочная миграция → деплой падает, web не перезапускается

## Подсказки

-

## Не делать

- ❌ Не запускать миграции из контейнера web на старте
