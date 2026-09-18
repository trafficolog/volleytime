---
id: '9.6'
phase: '9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: '/health (БД-коннект) + Sentry (web+bot) + UptimeRobot.'
estimated_hours: '2-3'
depends_on: ['9.2']
---

# Epic 9.6: /health + мониторинг (Sentry, UptimeRobot)

**Цель.** /health endpoint (проверка БД-коннекта). Sentry для исключений (web + bot). UptimeRobot пингует /health, alert при падении.

## Контекст

Решения 8, 9: Sentry + UptimeRobot + глубокий /health. Без мониторинга падение замечается поздно (когда жалуются пользователи). Sentry — что сломалось, UptimeRobot — что недоступно.

## Definition of Done

- /health endpoint (web): проверяет Postgres-коннект, 200 если ОК, 503 если БД недоступна
- Sentry SDK в web (Nuxt) — ловит server/client исключения
- Sentry SDK в bot — ловит ошибки обработчиков
- Sentry DSN через env (секрет)
- UptimeRobot: HTTP-монитор на https://volleytime.by/health, alert (email/telegram) при down
- Sentry не шлёт PII лишнего (фильтрация)

## Задачи

| ID    | Задача                         | Часов |
| ----- | ------------------------------ | ----: |
| 9.6.1 | /health endpoint + Sentry web  |   1-2 |
| 9.6.2 | Sentry bot + UptimeRobot setup |     1 |

## Не делать

- ❌ Не делать /health без проверки БД (решение 9 — глубокий)
- ❌ Не слать PII в Sentry
- ❌ Не делать метрики/Grafana — Phase 14+
