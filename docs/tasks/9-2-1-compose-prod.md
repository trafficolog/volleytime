---
id: '9.2.1'
phase: '9'
epic: '9.2'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 9.9.'
roles:
  - DEVOPS
depends_on:
  - '9.1.1'
  - '9.1.2'
estimated_hours: '2'
tags:
  - docker-compose
  - deploy
---

# Task 9.2.1: docker-compose.prod.yml (4 сервиса, сети, volumes)

## Цель

docker-compose.prod.yml с caddy, web, bot, postgres. Внутренняя сеть (web→bot internal notify, доступ к postgres), volumes (postgres data, caddy certs), healthchecks, restart policies.

## Контекст

Решения 1, 4: 4 контейнера, internal notify по внутренней сети. postgres и internal notify (bot:3001) — только внутренняя сеть, наружу не торчат. Caddy — единственная точка входа (80/443).

## Что должно быть сделано

1. **`docker-compose.prod.yml` (корень):**

   ```yaml
   services:
     caddy:
       image: caddy:2-alpine
       restart: unless-stopped
       ports:
         - '80:80'
         - '443:443'
       volumes:
         - ./Caddyfile:/etc/caddy/Caddyfile:ro
         - caddy_data:/data
         - caddy_config:/config
       depends_on:
         - web
         - bot
       networks:
         - frontend

     web:
       image: ghcr.io/USER/volleytime-web:latest # или build: для build-on-VPS
       restart: unless-stopped
       env_file: .env
       environment:
         - NODE_ENV=production
         - DATABASE_URL=postgres://volley:${DB_PASSWORD}@postgres:5432/volleytime
         - BOT_INTERNAL_URL=http://bot:3001
         - BOT_INTERNAL_SECRET=${BOT_INTERNAL_SECRET}
       depends_on:
         postgres:
           condition: service_healthy
       networks:
         - frontend
         - backend
       healthcheck:
         test: ['CMD', 'wget', '-qO-', 'http://localhost:3000/health']
         interval: 30s
         timeout: 5s
         retries: 3

     bot:
       image: ghcr.io/USER/volleytime-bot:latest
       restart: unless-stopped
       env_file: .env
       environment:
         - NODE_ENV=production
         - BOT_MODE=webhook
         - DATABASE_URL=postgres://volley:${DB_PASSWORD}@postgres:5432/volleytime
         - BOT_INTERNAL_SECRET=${BOT_INTERNAL_SECRET}
         - WEBHOOK_URL=https://volleytime.by/tg/webhook/${WEBHOOK_SECRET_PATH}
       depends_on:
         postgres:
           condition: service_healthy
       networks:
         - frontend # для webhook через caddy
         - backend # для internal notify + postgres
       # 8443 webhook, 3001 internal — НЕ публикуем (через caddy/внутр. сеть)

     postgres:
       image: postgres:16-alpine
       restart: unless-stopped
       environment:
         - POSTGRES_USER=volley
         - POSTGRES_PASSWORD=${DB_PASSWORD}
         - POSTGRES_DB=volleytime
       volumes:
         - postgres_data:/var/lib/postgresql/data
       networks:
         - backend
       healthcheck:
         test: ['CMD-SHELL', 'pg_isready -U volley -d volleytime']
         interval: 10s
         timeout: 5s
         retries: 5
       # порт НЕ публикуем (только внутренняя сеть)

   networks:
     frontend:
     backend:

   volumes:
     postgres_data:
     caddy_data:
     caddy_config:
   ```

2. **`.env.prod.example`** — шаблон секретов (без значений):

   ```
   DB_PASSWORD=
   BOT_TOKEN=
   BOT_INTERNAL_SECRET=
   WEBHOOK_SECRET_PATH=
   SENTRY_DSN_WEB=
   SENTRY_DSN_BOT=
   S3_ACCESS_KEY=
   S3_SECRET_KEY=
   S3_BUCKET=
   NUXT_PUBLIC_MINIAPP_BASE_URL=https://volleytime.by
   ```

3. **Сети:**
   - `frontend`: caddy ↔ web, caddy ↔ bot (webhook)
   - `backend`: web ↔ bot (internal notify), web/bot ↔ postgres
   - postgres только в backend (не доступен снаружи)

4. **Проверка:** `docker compose -f docker-compose.prod.yml up` поднимает все 4, healthchecks зелёные, postgres не доступен снаружи.

## Критерии приёмки

- ✅ 4 сервиса: caddy, web, bot, postgres
- ✅ Только caddy публикует порты (80/443)
- ✅ postgres и bot internal — НЕ публичны (внутренняя сеть)
- ✅ Volumes: postgres_data, caddy_data/config (персистентность)
- ✅ Healthchecks (web /health, postgres pg_isready)
- ✅ depends_on с condition (web/bot ждут healthy postgres)
- ✅ restart: unless-stopped
- ✅ env_file + .env.prod.example шаблон
- ✅ Сети frontend/backend разделены

## Подсказки

- **postgres БЕЗ ports:** доступ только по docker-сети (backend). Наружу 5432 не торчит — безопасность.
- **bot БЕЗ ports:** webhook идёт через caddy (frontend сеть), internal notify по backend сети. Прямого внешнего доступа нет.
- **condition: service_healthy** — web/bot не стартуют пока postgres не готов (избегаем race при старте).
- **image vs build:** для CI/CD (9.8) — image из ghcr. Для build-on-VPS fallback — build: context. Подготовить оба варианта (профили или комментарии).
- **DATABASE_URL** через внутреннее имя postgres:5432 (docker DNS).

## Не делать

- ❌ Не публиковать postgres/internal порты наружу
- ❌ Не коммитить .env (только .example)
- ❌ Не хранить данные без volume (потеря при пересоздании)
- ❌ Не давать всем сервисам обе сети без нужды
