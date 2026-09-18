---
id: '9.9'
phase: '9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: 'Фиксы находок ревью Phase 9 (5 P0, 4 P1, 2 P2).'
estimated_hours: '20-28'
depends_on: ['3.9', '8.8']
---

# Epic 9.9: Исправления по ревью v0.1.0 — Production Deploy

**Цель.** Сделать прод-развёртывание рабочим и проверяемым: сборка стартует, миграции применяются, webhook доходит до бота, smoke проверяет авторизованный сценарий, ошибки видны, бэкапы восстановимы.

## Контекст

Ревью: прод-сборка падала на любом обращении к сессии (схема better-auth — закрыто 3.9.3); smoke проверял только `/api/health`; маршрут Caddy `handle_path /tg/webhook/*` резал путь и бот отвечал 404; стадия миграций в compose использовала образ web с `|| echo`, маскируя ошибку; compose не передавал `NUXT_*`; Sentry не подключён; deploy не гонял typecheck и не откатывался; `pnpm.overrides` игнорируется pnpm 12; restore-test без `ON_ERROR_STOP`, бэкапы без шифрования и без healthcheck-пинга; у бота нет health-эндпоинта и он запускается через tsx.

## Definition of Done

- `docker compose -f docker-compose.prod.yml build` и старт web проходят; `/api/auth/get-session` отвечает 200
- Smoke: health (включая проверку БД и auth), авторизованный запрос, webhook-маршрут; падение smoke → откат релиза
- Caddy проксирует `/tg/webhook/<secret>` без обрезания пути
- Стадия миграций — отдельный образ/стадия, падение останавливает деплой
- Compose пробрасывает `NUXT_*` и обязательные переменные; старт без них падает с понятной ошибкой
- Sentry (web + bot) включается при наличии DSN
- CI/CD: typecheck и lint в deploy, откат на предыдущий образ при неуспехе smoke
- `pnpm.overrides` → `pnpm-workspace.yaml`
- Бэкапы: `ON_ERROR_STOP=1` в restore-test, ожидание готовности БД, шифрование, пинг healthcheck
- Бот: health-эндпоинт, ретраи подключения, `drop_pending_updates: false`, прод-образ на собранном JS
- Логи с ротацией, лимиты памяти, CSP и rate limit для `/api/auth/*`

## Задачи

| ID                                                 | Приоритет | Задача                                                                            | Часов |
| -------------------------------------------------- | --------- | --------------------------------------------------------------------------------- | ----: |
| [9.9.1](../tasks/9-9-1-prod-build-works.md)        | P0        | Прод-сборка стартует и отвечает на авторизованные запросы                         |   1-2 |
| [9.9.2](../tasks/9-9-2-smoke-authorized.md)        | P0        | Smoke: health c проверкой БД и auth, авторизованный запрос, webhook               |     2 |
| [9.9.3](../tasks/9-9-3-caddy-webhook-route.md)     | P0        | Caddy проксирует webhook без обрезания пути                                       |   0.5 |
| [9.9.4](../tasks/9-9-4-migrate-stage.md)           | P0        | Стадия миграций: отдельный образ, падение останавливает деплой                    |     1 |
| [9.9.5](../tasks/9-9-5-prod-config.md)             | P0        | Compose пробрасывает NUXT_* и обязательные переменные                             |     1 |
| [9.9.6](../tasks/9-9-6-sentry.md)                  | P1        | Sentry в web и боте (включается при наличии DSN)                                  |     2 |
| [9.9.7](../tasks/9-9-7-cicd-typecheck-rollback.md) | P1        | Deploy: typecheck/lint и откат при неуспешном smoke                               |   1-2 |
| [9.9.8](../tasks/9-9-8-pnpm-overrides.md)          | P1        | pnpm.overrides → pnpm-workspace.yaml                                              |   0.5 |
| [9.9.9](../tasks/9-9-9-backups-hardening.md)       | P1        | Бэкапы: ON_ERROR_STOP, ожидание БД, шифрование, пинг healthcheck                  |     2 |
| [9.9.10](../tasks/9-9-10-bot-runtime.md)           | P2        | Бот: health-эндпоинт, ретраи старта, drop_pending_updates=false, прод-образ на JS |   1-2 |
| [9.9.11](../tasks/9-9-11-ops-hardening.md)         | P2        | Ротация логов, лимиты памяти, CSP, rate limit для /api/auth/*                     |     2 |

## Не делать

- ❌ Kubernetes/оркестрация — вне MVP
- ❌ Платный APM — достаточно Sentry free

## Открытые вопросы

- нет
