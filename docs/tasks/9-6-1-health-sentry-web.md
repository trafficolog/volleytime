---
id: '9.6.1'
phase: '9'
epic: '9.6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 9.9.'
roles:
  - BACK
  - DEVOPS
depends_on:
  - '3.4.1'
  - '3.2'
estimated_hours: '1-2'
tags:
  - health
  - monitoring
  - sentry
---

# Task 9.6.1: /health endpoint + Sentry web

## Цель

/health endpoint (web) с проверкой Postgres-коннекта. Sentry SDK в web (Nuxt) для исключений.

## Контекст

Решения 8, 9: глубокий /health (БД), Sentry. /health для UptimeRobot (9.6.2) и docker healthcheck (9.2.1). Sentry ловит ошибки до жалоб пользователей.

## Что должно быть сделано

1. **/health endpoint `apps/web/server/api/health.get.ts`:**

   ```ts
   import { db } from '@volley-time/db'
   import { sql } from 'drizzle-orm'

   export default defineEventHandler(async (event) => {
     try {
       // проверка БД-коннекта
       await db.execute(sql`SELECT 1`)
       return { status: 'ok', db: 'ok', ts: new Date().toISOString() }
     } catch (e) {
       setResponseStatus(event, 503)
       return { status: 'error', db: 'down', ts: new Date().toISOString() }
     }
   })
   ```

2. **Sentry в Nuxt** — установить @sentry/nuxt:

   ```bash
   pnpm -F @volley-time/web add @sentry/nuxt
   ```

   Конфиг (sentry.server.config.ts / client.config.ts):

   ```ts
   import * as Sentry from '@sentry/nuxt'
   Sentry.init({
     dsn: process.env.SENTRY_DSN_WEB,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 0.1, // 10% трейсов (не перегружать)
     // фильтрация PII
     beforeSend(event) {
       // убрать чувствительное (email, telegram_id из контекста если попало)
       return event
     },
   })
   ```

   Nuxt module в nuxt.config (@sentry/nuxt/module).

3. **Sentry DSN через env** (секрет, GitHub Secrets → .env). Если DSN пуст (dev) — Sentry не инициализируется (no-op).

4. **PII фильтрация:** не слать email/telegram_id/токены в Sentry. beforeSend чистит, или настроить scrubbing.

5. **Проверка:**
   - /health → 200 {status: ok} когда БД жива
   - /health → 503 когда БД недоступна (остановить postgres → проверить)
   - Тестовое исключение → видно в Sentry dashboard

## Критерии приёмки

- ✅ /health проверяет Postgres (SELECT 1)
- ✅ 200 если БД ОК, 503 если недоступна
- ✅ Sentry SDK в web (server + client)
- ✅ DSN через env, пустой DSN → no-op (dev)
- ✅ Исключения попадают в Sentry
- ✅ PII фильтруется (beforeSend)
- ✅ tracesSampleRate разумный (не перегружать)

## Подсказки

- **/health глубокий (решение 9)** — простой «процесс жив» не ловит «БД отвалилась». SELECT 1 проверяет реальную работоспособность.
- **503 при БД down** — UptimeRobot (9.6.2) и docker healthcheck реагируют. Alert приходит.
- **Sentry beforeSend** — фильтр PII критичен (privacy). Email, telegram_id, токены не должны утекать в Sentry.
- **Пустой DSN no-op** — в dev Sentry не нужен, не падать если DSN не задан.
- **tracesSampleRate 0.1** — 10% performance-трейсов достаточно, 100% дорого/шумно.

## Не делать

- ❌ Не делать /health без проверки БД
- ❌ Не слать PII в Sentry
- ❌ Не падать при пустом DSN
- ❌ Не ставить tracesSampleRate 1.0 (перегруз)
