---
id: '3.6.1'
phase: '3'
epic: '3.6'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - DEVOPS
depends_on:
  - '3.1.1'
estimated_hours: '1-2'
tags:
  - docker
  - postgres
  - redis
  - dev
---

# Task 3.6.1: docker-compose.yml (postgres + redis + init scripts)

## Цель

Создать `docker-compose.yml` в корне репозитория для запуска PostgreSQL и Redis локально. Plus init-скрипт для создания тестовой БД (`volleytime_test`).

## Контекст

Каждый разработчик должен иметь возможность одной командой поднять весь dev-environment. Docker — стандарт для этого.

## Что должно быть сделано

1. **`docker-compose.yml` в корне:**

   ```yaml
   services:
     postgres:
       image: postgres:16-alpine
       container_name: volleytime_postgres
       restart: unless-stopped
       environment:
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: postgres
         POSTGRES_DB: volleytime_dev
       ports:
         - '5432:5432'
       volumes:
         - postgres_data:/var/lib/postgresql/data
         - ./docker/postgres-init:/docker-entrypoint-initdb.d:ro
       healthcheck:
         test: ['CMD-SHELL', 'pg_isready -U postgres']
         interval: 5s
         timeout: 5s
         retries: 10

     redis:
       image: redis:7-alpine
       container_name: volleytime_redis
       restart: unless-stopped
       ports:
         - '6379:6379'
       volumes:
         - redis_data:/data
       command: redis-server --save 60 1 --loglevel warning
       healthcheck:
         test: ['CMD', 'redis-cli', 'ping']
         interval: 5s
         timeout: 3s
         retries: 5

   volumes:
     postgres_data:
       driver: local
     redis_data:
       driver: local
   ```

2. **`docker/postgres-init/01-create-test-db.sql`** — init script для создания тестовой БД:

   ```sql
   -- Создаёт volleytime_test для интеграционных тестов
   CREATE DATABASE volleytime_test;
   GRANT ALL PRIVILEGES ON DATABASE volleytime_test TO postgres;
   ```

   (PostgreSQL автоматически выполняет .sql/.sh файлы из `/docker-entrypoint-initdb.d/` при первом старте)

3. **`.env.example`** (обновить):

   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/volleytime_dev
   DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/volleytime_test
   REDIS_URL=redis://localhost:6379
   ```

4. **`docker/README.md`** — короткая инструкция:

   ````markdown
   # Docker dev environment

   ## Quick start

   ```bash
   pnpm dev:db       # старт postgres + redis
   pnpm dev:db:down  # остановка
   pnpm dev:db:reset # удалить данные и пересоздать (drop volumes)
   ```
   ````

   ## Изменение init-скриптов

   PostgreSQL выполняет /docker-entrypoint-initdb.d/* только при первом старте (когда volume пустой).
   Чтобы перезапустить init — `pnpm dev:db:reset`.

   ```

   ```

5. **Удостовериться, что volume names префиксированы**, иначе при наличии других docker-compose проектов на машине будет конфликт. По умолчанию compose добавляет имя папки — `volley_time_platform_postgres_data`. Это нормально, но можно явно указать `name: volleytime` в compose root.

## Критерии приёмки

- ✅ `docker compose up -d` поднимает обе службы
- ✅ `docker compose ps` показывает обе как `healthy`
- ✅ Можно подключиться: `psql postgresql://postgres:postgres@localhost:5432/volleytime_dev`
- ✅ Тестовая БД существует: `psql postgresql://postgres:postgres@localhost:5432/volleytime_test -c '\l'` — `volleytime_test` в списке
- ✅ Redis доступен: `redis-cli ping` → `PONG`
- ✅ `docker compose down` останавливает службы
- ✅ Данные persisted между рестартами: после `docker compose down && docker compose up -d` данные сохраняются
- ✅ `docker compose down -v` (с volume) — стирает данные, init-скрипт выполняется заново

## Подсказки

- **PostgreSQL 16 vs 15:** 16 стабильный, имеет лучший планировщик. Берём 16-alpine.
- **Redis save command** — Redis по умолчанию делает snapshot, `--save 60 1` означает «снимать если за 60 сек был ≥1 write». Для dev можно `--save ""` (без persist), но persist даёт большую близость к prod.
- **Если в Mac/Windows Docker — slow file IO,** добавить `:cached` или `:delegated` суффиксы к volume mounts (но для именованных volumes — не нужно).
- **macOS Docker Desktop** иногда жрёт много RAM. Для dev — выделить 4 GB достаточно.

## Не делать

- ❌ Не настраивать reverse proxy (Caddy/Nginx) в этом compose — это Phase 9
- ❌ Не контейнеризовать apps/web и apps/bot — для dev запускаем нативно через `tsx`/`nuxt dev`
- ❌ Не добавлять Adminer / pgAdmin — `pnpm db:studio` достаточно
- ❌ Не настраивать SSL / TLS для PG в dev
- ❌ Не делать production-grade конфиг PostgreSQL (shared_buffers, work_mem) — defaults сойдут
