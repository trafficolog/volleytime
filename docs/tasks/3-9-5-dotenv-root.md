---
id: '3.9.5'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · P1 #5'
priority: P1
roles:
  - DEVOPS
depends_on:
  - '3.9.2'
estimated_hours: '0.5-1'
tags:
  - env
  - dx
  - review-fix
---

# Task 3.9.5: Корневой .env читается web и ботом в dev

## Цель

`pnpm dev` поднимает web и bot с переменными из корневого `.env`.

## Контекст

Nuxt ищет `.env` в `apps/web`, бот не грузит dotenv вовсе → все страницы 500 `DATABASE_URL is not set`.

## Что должно быть сделано

1. `apps/web/package.json`: `"dev": "nuxt dev --dotenv ../../.env"`.
2. `apps/bot/package.json`: `"dev": "tsx watch --env-file-if-exists=../../.env src/index.ts"` (Node ≥ 22 / tsx поддерживает флаг).
3. README quickstart: `cp .env.example .env`.

## Критерии приёмки

- ✅ `pnpm dev:web` без экспорта переменных → страницы 200
- ✅ `pnpm dev:bot` стартует с токеном из корневого `.env`

## Подсказки

- В production переменные приходят из compose `env_file`, dotenv там не нужен.

## Не делать

- ❌ Не коммитить `.env`
