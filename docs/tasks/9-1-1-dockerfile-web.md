---
id: '9.1.1'
phase: '9'
epic: '9.1'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'Production web image builds from the monorepo root, runs as a healthy container on port 3000 and serves the database-backed public health endpoint.'
roles:
  - DEVOPS
  - BACK
depends_on:
  - '3.1'
estimated_hours: '1-2'
tags:
  - docker
  - deploy
  - nuxt
---

# Task 9.1.1: Dockerfile.web (Nuxt multi-stage)

## Цель

Production Dockerfile для apps/web (Nuxt SSR). Multi-stage: deps → build → минимальный runtime. Работа с pnpm monorepo.

## Контекст

Монорепо pnpm + Turborepo. Образ web должен собрать Nuxt в production-режиме, включив только нужные workspace-пакеты (db, auth, и т.д.), без раздувания.

## Что должно быть сделано

1. **`apps/web/Dockerfile`:**

   ```dockerfile
   # ---- Base ----
   FROM node:22-alpine AS base
   RUN corepack enable
   WORKDIR /app

   # ---- Dependencies ----
   FROM base AS deps
   # Копируем манифесты монорепо для установки workspace
   COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
   COPY apps/web/package.json apps/web/package.json
   COPY packages/db/package.json packages/db/package.json
   COPY packages/auth/package.json packages/auth/package.json
   # (+ другие packages, от которых зависит web)
   RUN pnpm install --frozen-lockfile

   # ---- Build ----
   FROM base AS build
   COPY --from=deps /app/node_modules ./node_modules
   COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
   COPY . .
   # Build только web (+ его зависимости через turbo)
   RUN pnpm --filter @volley-time/web build

   # ---- Runtime ----
   FROM node:22-alpine AS runtime
   WORKDIR /app
   ENV NODE_ENV=production
   # Nuxt output (.output) — самодостаточный
   COPY --from=build /app/apps/web/.output ./.output
   EXPOSE 3000
   ENV PORT=3000 HOST=0.0.0.0
   CMD ["node", ".output/server/index.mjs"]
   ```

2. **`.dockerignore` (корень):**

   ```
   **/node_modules
   **/.nuxt
   **/.output
   **/dist
   .git
   **/.env
   **/.env.*
   **/*.log
   .turbo
   ```

3. **Проверка:**
   - Nuxt `.output` самодостаточный (nitro собирает всё нужное) — runtime образ не требует node_modules
   - Build args для public env (NUXT_PUBLIC_*) если нужны на этапе сборки
   - Образ собирается: `docker build -f apps/web/Dockerfile -t volleytime-web .` (контекст = корень монорепо)

4. **Размер:** alpine + только .output → компактный образ (десятки МБ). Проверить `docker images`.

## Критерии приёмки

- ✅ Multi-stage (deps/build/runtime)
- ✅ pnpm workspace install (frozen lockfile)
- ✅ Только web + зависимости (не весь монорепо)
- ✅ Runtime образ минимальный (Nuxt .output, без dev-deps)
- ✅ .dockerignore исключает node_modules/.env/.git
- ✅ Образ собирается из корня монорепо
- ✅ Контейнер запускается, слушает :3000
- ✅ /health доступен (после 9.6.1)

## Подсказки

- **Контекст сборки = корень монорепо** (не apps/web), т.к. pnpm workspace нужен lockfile и пакеты. `-f apps/web/Dockerfile .`
- **Nuxt .output самодостаточный** — nitro бандлит зависимости, runtime не требует node_modules. Это сильно уменьшает образ.
- **corepack enable** — pnpm через corepack (нода 22 включает).
- **Public env на build** — если NUXT_PUBLIC_MINIAPP_BASE_URL нужен на сборке, передать build-arg. Server env (секреты) — в runtime через docker-compose env.
- **node:22-alpine** — текущая LTS, компактный.

## Не делать

- ❌ Не копировать весь монорепо в runtime (только .output)
- ❌ Не оставлять dev-зависимости в runtime
- ❌ Не хардкодить секреты/env в образ
- ❌ Не собирать из apps/web как контекст (нужен корень)

## Production evidence — 2026-09-21

- SHA-tagged image `volleytime-web:c8648c25ce2e1955806cb051af5365089945d2ca` runs in production and is approximately 63 MB.
- `vt_web` is healthy and `https://volleytime.by/api/health` returns HTTP 200 with `db=ok`, `auth=ok` and the exact release SHA.
