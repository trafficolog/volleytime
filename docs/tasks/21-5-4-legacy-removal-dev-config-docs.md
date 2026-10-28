---
id: '21.5.4'
phase: '21'
epic: '21.5'
status: todo
release: 'v0.3.1'
sync_state: synced
last_reviewed: 2026-10-28
status_note: 'Пакет 3 из отчёта 21.5.1: LEG-06…LEG-12 (dev-конфигурация и устаревшие гайды).'
ref_id: ''
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS, TECHNICAL_WRITER]
depends_on: ['21.5.1', '21.3.1']
supersedes: []
decisions: []
estimated_hours: '2-8'
reference:
  spec: ''
  screens: []
tags: [reference-v3, cleanup, docs]
---

# Task 21.5.4: Удаление наследия, пакет 3: dev-конфигурация и устаревшие гайды

## Цель

Убрать из dev-конфигурации ключи без потребителей (`LEG-06`, `LEG-07`) и привести устаревшие документы в соответствие с кодом и runbook (`LEG-08`…`LEG-12`) по принятому отчёту [21.5.1](../operations/reviews/2026-10-28-legacy-inventory.md).

## Контекст

- Один пакет = одна ветка, один PR. Предыдущие: [21.5.2](21-5-2-legacy-removal-batches.md), [21.5.3](21-5-3-legacy-removal-styles.md); следующие: [21.5.5](21-5-5-legacy-history-condense.md) и далее до [21.5.9](21-5-9-legacy-event-pricing-projection.md).
- Старт — после `21.3.1`. Пакет **не** меняет `.github/workflows`, production-конфигурацию (`docker-compose.prod.yml`, `.env.prod.example`, `render-production-env.mjs`), `package.json` зависимостей и `pnpm-lock.yaml`.
- Риск пакета низкий; `turbo.json` меняется только списком `globalEnv` (ключ `REDIS_URL`), что сбрасывает кэш Turbo, но не меняет сборку.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5`; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

Состав пакета:

| ID     | Объект                                                                                         | Действие                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LEG-06 | `REDIS_URL` в `.env.example` и `turbo.json` (`globalEnv`)                                      | удалить; проверка: `rg --hidden -n -i "redis" -g '!node_modules' -g '!docs/**' -g '!legacy' -g '!pnpm-lock.yaml' .` без чтений `REDIS_URL` в коде                                                                                                                                                                                                                                             |
| LEG-07 | закомментированная строка `# UNISENDER_GO_API_KEY=... (Phase 9)` в `.env.example` (только она) | удалить только эту строку; проверка: `rg -in "unisender" apps packages scripts .env.example .env.prod.example` — ключ `UNISENDER_GO_API_KEY` ни в одном коде не читается. Драйвер-плейсхолдер `packages/auth/src/email/unisender-driver.ts`, выбор `EMAIL_DRIVER=unisender`, тест `email.test.ts` и строка 24 `.env.example` «Email (dev: console, prod: Unisender Go)» **остаются** (LEG-29) |
| LEG-08 | комментарий «очередь задач на pg-boss (Postgres)» в `docker-compose.yml`                       | заменить на описание фактического планировщика (`packages/core/src/scheduler`), без упоминания несуществующей зависимости                                                                                                                                                                                                                                                                     |
| LEG-09 | `docs/guides/DEPLOY.md`                                                                        | баннер «черновик стратегии 2026-05-25, действующая процедура — deploy runbook»; убрать Redis (контейнер, `REDIS_URL`); файл не удалять (ссылки из `README.md`, `ARCHITECTURE.md`, фазы 9)                                                                                                                                                                                                     |
| LEG-10 | Redis/BullMQ в `docs/architecture/ARCHITECTURE.md` и `docs/architecture/STACK_DECISIONS.md`    | привести к фактическому стеку (PostgreSQL, планировщик на собственном коде); исторические строки `ROADMAP.md`, `MIGRATION_STRATEGY.md`, `DOMAIN.md` не править                                                                                                                                                                                                                                |
| LEG-11 | `scripts/README.md`                                                                            | индекс всех скриптов (назначение, кто вызывает); деплой и откат отсылают к runbook                                                                                                                                                                                                                                                                                                            |
| LEG-12 | `docs/operations/runbooks/mvp-qa-checklist.md`                                                 | баннер «исторический чек-лист R0/v0.1.0» и входящая ссылка из индекса runbooks; файл не удалять                                                                                                                                                                                                                                                                                               |

## Что должно быть сделано

1. Повторить проверки по составу на текущем `main`; изменившееся состояние записать в отчёте.
2. Внести правки по таблице. Для документов — только фактические исправления и баннеры; не переписывать решения и историю.
3. Проверить локальные ссылки изменённых документов и `pnpm format:check`; для `.env.example` и `turbo.json` — `pnpm turbo run build --dry=json` или эквивалентный прогон, подтверждающий отсутствие требования `REDIS_URL`.
4. Обновить отчёт аудита: статусы `LEG-06`…`LEG-12` — выполнено + номер PR.

## Критерии приёмки

- ✅ Изменены только объекты `LEG-06`…`LEG-12`; список совпадает с составом пакета
- ✅ Пять gates на tested revision; сборка зелёная (без `REDIS_URL` в окружении)
- ✅ В `.github/workflows`, production-конфигурации, `package.json` и `pnpm-lock.yaml` изменений нет
- ✅ Локальные ссылки изменённых документов рабочие; факты в документах совпадают с кодом и deploy runbook
- ✅ Ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не удалять `docs/guides/DEPLOY.md` и `mvp-qa-checklist.md`: только обновить
- ❌ Не трогать `packages/auth/src/email/*` (драйвер Unisender — путь авторизации по email, LEG-29) и строку 24 `.env.example`
- ❌ Не менять `docker-compose.prod.yml`, `.env.prod.example`, `render-production-env.mjs`, workflows и `:latest`-значения (решение владельца OQ-1)
- ❌ Не трогать данные, миграции, rollback-скрипты и quiescent-guard
- ❌ Не включать баннеры `current-state`, `RELEASES`, `deploy.md` (пакет 21.5.5 после ответа владельца)
