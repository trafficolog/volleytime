---
id: '3.6'
phase: '3'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Docker compose для dev: PostgreSQL + Redis. Без production-конфигов.'
estimated_hours: '2-3'
depends_on: ['3.1']
---

# Epic 3.6: Docker dev environment

**Цель.** Создать `docker-compose.yml` для local dev: PostgreSQL 16 + Redis 7. Команда `pnpm dev:db` поднимает их.

## Контекст

Dev-окружение должно быть **одной командой**. Установка PostgreSQL и Redis локально на macOS/Linux/Windows — это пять разных инструкций. Docker даёт единообразие.

В Phase 3 — **только dev-конфиг**. Production-конфиг (с Caddy, persistent volumes на нужном пути, security hardening) — это Phase 9.

## Definition of Done

- `docker-compose.yml` в корне репозитория
- Сервисы: `postgres` (port 5432), `redis` (port 6379)
- Persistent volumes для данных (`postgres_data`, `redis_data`)
- Healthcheck для каждого сервиса
- `pnpm dev:db` поднимает только БД (без apps)
- `pnpm dev` поднимает БД + web + bot (через Turborepo)
- В `.env.example` есть `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/volleytime_dev` и `REDIS_URL=redis://localhost:6379`
- Дополнительная БД для тестов (`volleytime_test`) создаётся init-скриптом

## Задачи

| ID                                        | Задача                                                     | Часов |
| ----------------------------------------- | ---------------------------------------------------------- | ----: |
| [3.6.1](../tasks/3-6-1-docker-compose.md) | docker-compose.yml (postgres + redis + init scripts)       |   1-2 |
| [3.6.2](../tasks/3-6-2-dev-scripts.md)    | pnpm-scripts для управления (`dev`, `dev:db`, `dev:reset`) |     1 |

## Не делать

- ❌ Не делать prod docker-compose — Phase 9
- ❌ Не контейнеризовать app/bot — для dev запускаем нативно через Node.js (быстрее iterate)
- ❌ Не добавлять Adminer / pgAdmin — `pnpm db:studio` через Drizzle Studio достаточно
- ❌ Не настраивать backup в dev

## Открытые вопросы

- Какой PostgreSQL version? **Решение:** 16-alpine (стабильный, лёгкий)
- Какой Redis version? **Решение:** 7-alpine (для better-auth sessions если решим хранить в Redis)
