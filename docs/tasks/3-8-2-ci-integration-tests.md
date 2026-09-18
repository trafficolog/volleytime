---
id: '3.8.2'
phase: '3'
epic: '3.8'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - DEVOPS
  - QA
depends_on:
  - '3.8.1'
  - '3.7.2'
estimated_hours: '1'
tags:
  - ci
  - integration-tests
  - postgres
---

# Task 3.8.2: Integration test job с PostgreSQL service container

## Цель

Добавить в CI отдельный job для интеграционных тестов с PostgreSQL — поднимается как service container в GitHub Actions, миграции применяются, тесты запускаются.

## Контекст

Integration-тесты требуют живой PostgreSQL. GitHub Actions поддерживает [service containers](https://docs.github.com/en/actions/using-containerized-services/about-service-containers) — Docker-контейнеры, которые поднимаются для одного job и доступны по сети.

Решение из phase-card: shared PG (как локально), но в CI каждый workflow получает свежую БД.

## Что должно быть сделано

1. **Добавить job в `.github/workflows/ci.yml`** (расширяет ci.yml из 3.8.1):

   ```yaml
   test-integration:
     name: Integration Tests
     runs-on: ubuntu-latest
     services:
       postgres:
         image: postgres:16-alpine
         env:
           POSTGRES_USER: postgres
           POSTGRES_PASSWORD: postgres
           POSTGRES_DB: volleytime_test
         ports:
           - 5432:5432
         options: >-
           --health-cmd "pg_isready -U postgres"
           --health-interval 5s
           --health-timeout 5s
           --health-retries 10
     env:
       DATABASE_URL: postgresql://postgres:postgres@localhost:5432/volleytime_test
       DATABASE_URL_TEST: postgresql://postgres:postgres@localhost:5432/volleytime_test
       BETTER_AUTH_SECRET: ci_test_secret_replace_with_real_in_prod
       BETTER_AUTH_URL: http://localhost:3000
       TELEGRAM_BOT_TOKEN: 1234567890:CI_TEST_TOKEN
       TELEGRAM_BOT_USERNAME: ci_test_bot
       EMAIL_DRIVER: console
     steps:
       - uses: actions/checkout@v4
       - uses: pnpm/action-setup@v4
         with:
           version: ${{ env.PNPM_VERSION }}
       - uses: actions/setup-node@v4
         with:
           node-version: ${{ env.NODE_VERSION }}
           cache: 'pnpm'
       - run: pnpm install --frozen-lockfile
       - name: Wait for PostgreSQL
         run: |
           timeout 30 bash -c 'until pg_isready -h localhost -p 5432 -U postgres; do sleep 1; done'
       - name: Apply migrations
         run: pnpm db:migrate
       - name: Run integration tests
         run: pnpm test:integration
   ```

2. **Проверочный шаг — миграции на чистой БД** (только на push в main):

   ```yaml
   migrations-check:
     name: Migrations on clean DB
     if: github.event_name == 'push' && github.ref == 'refs/heads/main'
     runs-on: ubuntu-latest
     services:
       postgres:
         image: postgres:16-alpine
         env:
           POSTGRES_USER: postgres
           POSTGRES_PASSWORD: postgres
           POSTGRES_DB: volleytime_clean
         ports:
           - 5432:5432
         options: >-
           --health-cmd "pg_isready -U postgres"
           --health-interval 5s
           --health-timeout 5s
           --health-retries 10
     env:
       DATABASE_URL: postgresql://postgres:postgres@localhost:5432/volleytime_clean
     steps:
       - uses: actions/checkout@v4
       - uses: pnpm/action-setup@v4
         with:
           version: ${{ env.PNPM_VERSION }}
       - uses: actions/setup-node@v4
         with:
           node-version: ${{ env.NODE_VERSION }}
           cache: 'pnpm'
       - run: pnpm install --frozen-lockfile
       - name: Apply all migrations
         run: pnpm db:migrate
       - name: Verify no pending migrations
         run: |
           # Drizzle migrate возвращает no-op при повторном запуске
           pnpm db:migrate
   ```

3. **Обновить branch protection (UI):**
   - Добавить `test-integration` в required status checks

## Критерии приёмки

- ✅ `test-integration` job появляется в Actions UI при каждом push/PR
- ✅ PostgreSQL service container поднимается за < 10 сек
- ✅ Миграции применяются без ошибок
- ✅ Integration-тесты проходят
- ✅ Если интеграционный тест падает — job красный
- ✅ Total время `test-integration` ≤ 2 минуты
- ✅ На push в main дополнительно запускается `migrations-check`

## Подсказки

- **`pg_isready`** в service container — health check Docker. Перед запуском steps GH Actions ждёт healthy.
- **Дополнительная проверка `pg_isready` в step** — страховка, иногда service "healthy" но connection ещё не готов.
- **Каждый workflow run получает свежий контейнер** — изоляция бесплатно.
- **Secrets в CI:** `BETTER_AUTH_SECRET=ci_test_secret...` — для тестов любая строка подойдёт. Для production env-secrets — через GitHub Settings → Secrets (Phase 9).
- **Если integration-тесты flaky** — увеличь `testTimeout` в vitest.integration.config.ts или добавь retry: `test.retry: 1` для отдельных тестов.

## Не делать

- ❌ Не использовать Docker-in-Docker — GH Actions service containers достаточно
- ❌ Не использовать testcontainers внутри тестов — двойной overhead
- ❌ Не запускать `dev:db` в CI — service container в job spec проще
- ❌ Не подключать Redis service container — пока не используется в integration-тестах (добавится в Phase 4+ если better-auth выберет Redis sessions)
