---
id: '9.1.2'
phase: '9'
epic: '9.1'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: bot Docker image успешно собирается/pushится в GitHub Actions; runtime запуск на production stack ждёт первого VPS deploy."
roles:
  - DEVOPS
  - BACK
depends_on:
  - '3.5.1'
  - '8.4.1'
estimated_hours: '1'
tags:
  - docker
  - deploy
  - grammy
---

# Task 9.1.2: Dockerfile.bot (grammY + internal notify)

## Цель

Production Dockerfile для apps/bot (grammY). Включает webhook listener + internal notify endpoint (web→bot). Multi-stage.

## Контекст

Bot — Node-процесс с grammY. В production: webhook listener (от Telegram) + internal notify (от web, 8.4.1). Образ собирает bot + нужные пакеты монорепо (db для резолва telegram_id, общие утилиты).

## Что должно быть сделано

1. **`apps/bot/Dockerfile`:**

   ```dockerfile
   FROM node:22-alpine AS base
   RUN corepack enable
   WORKDIR /app

   FROM base AS deps
   COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
   COPY apps/bot/package.json apps/bot/package.json
   COPY packages/db/package.json packages/db/package.json
   # (+ пакеты, от которых зависит bot)
   RUN pnpm install --frozen-lockfile

   FROM base AS build
   COPY --from=deps /app/node_modules ./node_modules
   COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
   COPY . .
   RUN pnpm --filter @volley-time/bot build

   FROM node:22-alpine AS runtime
   WORKDIR /app
   RUN corepack enable
   ENV NODE_ENV=production
   # bot не self-contained как Nuxt — нужны node_modules (prod only)
   COPY --from=deps /app/node_modules ./node_modules
   COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
   COPY --from=build /app/apps/bot/dist ./apps/bot/dist
   COPY --from=build /app/packages ./packages
   COPY apps/bot/package.json ./apps/bot/
   # порты: webhook (8443) + internal notify (3001)
   EXPOSE 8443 3001
   CMD ["node", "apps/bot/dist/index.js"]
   ```

2. **Если bot использует tsx/esbuild для сборки** — настроить build script в apps/bot/package.json (компиляция TS → dist). Либо запуск через tsx в production (проще, но tsx в runtime). Для production предпочтительно собранный JS.

3. **Prune dev-зависимостей:** runtime node_modules должны быть production-only. Вариант: `pnpm install --prod` в deps-стейдже для runtime, или `pnpm deploy --prod` для извлечения. Уточнить в реализации (pnpm deploy удобен для монорепо).

4. **Проверка:**
   - Образ собирается: `docker build -f apps/bot/Dockerfile -t volleytime-bot .`
   - Контейнер запускается, оба listener поднимаются (webhook 8443, internal 3001)
   - В dev может работать long-polling (env BOT_MODE), webhook — в prod

## Критерии приёмки

- ✅ Multi-stage Dockerfile.bot
- ✅ pnpm workspace, только bot + зависимости
- ✅ Runtime: production node_modules + dist
- ✅ Порты 8443 (webhook) и 3001 (internal notify) экспонированы
- ✅ Образ собирается из корня монорепо
- ✅ Контейнер запускается
- ✅ Размер разумный (prune dev-deps)

## Подсказки

- **Bot не self-contained** (в отличие от Nuxt .output) — нужны node_modules в runtime. Поэтому prod-only install/prune важен для размера.
- **pnpm deploy --prod --filter @volley-time/bot** — извлекает bot с prod-зависимостями в отдельную папку, удобно для Docker. Рассмотреть.
- **Два порта:** 8443 webhook (наружу через Caddy), 3001 internal notify (внутренняя сеть, 8.4.1). docker-compose свяжет.
- **packages в runtime** — если bot импортирует @volley-time/db и т.д. как workspace, нужны собранные пакеты. pnpm deploy решает это.

## Не делать

- ❌ Не тащить dev-зависимости (tsx/vitest) в runtime
- ❌ Не выставлять 3001 (internal) наружу (только docker-сеть)
- ❌ Не хардкодить токен бота
- ❌ Не собирать из apps/bot контекста (нужен корень)
