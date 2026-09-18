---
id: '3.7'
phase: '3'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Vitest + smoke-тесты. Unit + integration с реальной PG.'
estimated_hours: '3-4'
depends_on: ['3.2', '3.3']
---

# Epic 3.7: Vitest setup + smoke tests

**Цель.** Настроить Vitest для unit-тестов и `vitest --config integration.config.ts` для интеграционных с PostgreSQL. Написать smoke-тесты для каждого пакета.

## Контекст

Vitest — быстрый, TypeScript-native, поддерживает workspaces. Решение по тестам утверждено в phase-card:

- **Unit-тесты** — Vitest, мокаем БД и внешние зависимости
- **Integration** — отдельная команда, использует реальный PostgreSQL (тот же, что dev, но другая БД `volleytime_test`)
- **CI** — PG как service container (см. Epic 3.8)

Smoke-тесты в Phase 3 минимальны: пакет импортируется, базовая функция работает.

## Definition of Done

- Vitest установлен в каждом пакете
- Root `pnpm test` запускает все unit-тесты через Turborepo
- `pnpm test:integration` запускает интеграционные на `volleytime_test` БД
- Перед каждым integration-test suite — БД дропается и применяются миграции
- Smoke-тесты для:
  - `packages/db`: создание/чтение User (integration)
  - `packages/auth`: send-code → verify (integration, с mock email logger)
  - `apps/web`: рендер `/` страницы (unit / SSR test)
  - `apps/bot`: handler `/start` отвечает корректно (unit с mock Telegram)
- Все тесты проходят локально

## Задачи

| ID                                             | Задача                                               | Часов |
| ---------------------------------------------- | ---------------------------------------------------- | ----: |
| [3.7.1](../tasks/3-7-1-vitest-setup.md)        | Vitest setup + workspaces config                     |     1 |
| [3.7.2](../tasks/3-7-2-integration-helpers.md) | Helpers для integration-тестов (test DB, migrations) |   1-2 |
| [3.7.3](../tasks/3-7-3-smoke-tests.md)         | Smoke-тесты для всех пакетов                         |   1-2 |

## Не делать

- ❌ Не делать E2E (Playwright) — это Phase 9
- ❌ Не делать UI-тесты (Vue Test Utils) — лишнее в Phase 3
- ❌ Не настраивать coverage reports — Phase 9
- ❌ Не тестировать chain `/start` в боте → реальный Telegram — мокаем grammY API

## Открытые вопросы

- Testcontainers vs shared PG? **Решение** (из phase-card): shared PG (`volleytime_test` на том же Docker-инстансе как dev). Быстрее, проще debugging.
- Параллельные тесты на одной БД? **Решение:** Vitest по умолчанию изолирует тесты по файлам через workers. Внутри одного файла — sequence. Конфликт возможен только если разные test files пишут в одни таблицы одновременно. Если возникнет — переходим на `vitest --pool=forks --poolOptions.forks.singleFork=true` для integration-suite.
