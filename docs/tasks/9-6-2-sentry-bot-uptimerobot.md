---
id: '9.6.2'
phase: '9'
epic: '9.6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: Sentry bot + bot.catch + healthz реализованы; UptimeRobot и реальные Sentry/alert tests не настроены и не проверены.'
roles:
  - BACK
  - DEVOPS
depends_on:
  - '9.6.1'
  - '9.4.1'
estimated_hours: '1'
tags:
  - sentry
  - uptimerobot
  - monitoring
---

# Task 9.6.2: Sentry bot + UptimeRobot setup

## Цель

Sentry SDK в bot (ошибки обработчиков). UptimeRobot HTTP-монитор на /health с alert при падении.

## Контекст

Решение 8: Sentry для bot + UptimeRobot. Bot-ошибки (упавший обработчик, сбой Telegram API) должны быть видны. UptimeRobot — внешний пинг (если весь VPS лёг, внутренний мониторинг не поможет).

## Что должно быть сделано

1. **Sentry в bot:**

   ```bash
   pnpm -F @volley-time/bot add @sentry/node
   ```

   ```ts
   import * as Sentry from '@sentry/node'
   Sentry.init({
     dsn: process.env.SENTRY_DSN_BOT,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 0.1,
   })
   ```

2. **grammY error handler** — ловить ошибки обработчиков в Sentry:

   ```ts
   bot.catch((err) => {
     console.error('[bot] error', err)
     Sentry.captureException(err.error, {
       extra: { update_id: err.ctx.update.update_id },
       // НЕ слать содержимое сообщений (PII)
     })
   })
   ```

3. **Sentry в internal notify / webhook server** — обернуть критичные точки captureException при сбоях.

4. **UptimeRobot setup:**
   - Создать HTTP(s) монитор: https://volleytime.by/health
   - Интервал: 5 мин
   - Alert: при статусе != 200 (включая 503 от БД-сбоя)
   - Уведомление: email + опц Telegram (UptimeRobot поддерживает)
   - Keyword-проверка опц: тело содержит "ok"

5. **Bot reachability (опц):** UptimeRobot не пингует webhook (секретный). Можно добавить простой публичный bot /ping endpoint или полагаться на /health (web) + Sentry (bot ошибки). Для MVP /health (web) + Sentry достаточно.

6. **Документировать алерты** — куда приходят, кто реагирует (runbook).

## Критерии приёмки

- ✅ Sentry SDK в bot
- ✅ bot.catch → Sentry captureException (без PII содержимого)
- ✅ Sentry DSN bot через env
- ✅ UptimeRobot монитор на /health (5 мин)
- ✅ Alert при !=200 (email + опц Telegram)
- ✅ Тест: остановить web/БД → UptimeRobot алертит
- ✅ Тест: bot-ошибка → Sentry

## Подсказки

- **bot.catch обязателен** — grammY без него крашит на необработанной ошибке обработчика. Ловим + Sentry + не падаем.
- **PII в bot Sentry** — НЕ слать текст сообщений/имена. Только update_id, тип ошибки. Privacy.
- **UptimeRobot внешний** — если VPS целиком лёг, внутренний healthcheck молчит, внешний пинг алертит. Незаменим.
- **Alert в Telegram** — UptimeRobot умеет, удобно (узнаёшь о падении в том же мессенджере).
- **/health покрывает web+БД**; bot отдельно через Sentry (ошибки) — для MVP достаточно, не усложнять отдельным bot-пингом.

## Не делать

- ❌ Не оставлять bot без bot.catch (краши)
- ❌ Не слать PII (тексты/имена) в Sentry
- ❌ Не делать интервал пинга < 5 мин (лимиты бесплатного UptimeRobot)
- ❌ Не делать сложный observability — Phase 14+
