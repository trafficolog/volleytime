---
id: '9.9.1'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 9 · P0 #1'
priority: P0
roles:
  - DEVOPS
  - BACK
depends_on:
  - '3.9.3'
estimated_hours: '1-2'
tags:
  - docker
  - build
  - review-fix
---

# Task 9.9.1: Прод-сборка стартует и отвечает на авторизованные запросы

## Цель

`node .output/server/index.mjs` с прод-переменными обслуживает вход и API.

## Контекст

В v0.1.0 любой запрос к сессии падал на схеме better-auth (закрыто 3.9.3); проверки прод-сборки не было.

## Что должно быть сделано

1. Собрать `nuxt build`, поднять `.output` с прод-env на тестовой БД, проверить `/api/health`, `/api/auth/get-session`, `POST /api/auth/sign-in/telegram`.
2. Зафиксировать проверку скриптом `scripts/verify-build.sh` (используется в CI).

## Критерии приёмки

- ✅ `get-session` → 200 (не 500)
- ✅ Скрипт проверки в репозитории и в CI

## Подсказки

- Стадия runner копирует только `.output` и `node_modules` прод-зависимостей.

## Не делать

- ❌ Не запускать прод через `nuxt dev`
