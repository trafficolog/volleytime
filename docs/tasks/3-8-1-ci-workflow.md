---
id: '3.8.1'
phase: '3'
epic: '3.8'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - DEVOPS
depends_on:
  - '3.7.3'
estimated_hours: '1-2'
tags:
  - ci
  - github-actions
  - lint
  - typecheck
---

# Task 3.8.1: ci.yml — lint + typecheck + unit test

## Цель

Создать GitHub Actions workflow, который на каждый push/PR в `main` запускает параллельно: lint, typecheck, unit-test. Включить Turborepo cache между runs.

## Контекст

CI должен быть быстрым (≤ 3 минуты на MVP) и надёжным. Без Turbo cache каждый build с нуля — мы вынимаем выгоду из всего, что закешировано.

Integration-тесты с PG — отдельная задача (3.8.2). В этой задаче — только lightweight checks.

## Что должно быть сделано

1. **Создать `.github/workflows/ci.yml`:**

   ```yaml
   name: CI

   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]

   concurrency:
     group: ci-${{ github.ref }}
     cancel-in-progress: true

   env:
     NODE_VERSION: '20'
     PNPM_VERSION: '9'

   jobs:
     lint:
       name: Lint + Format
       runs-on: ubuntu-latest
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
         - name: Turbo cache
           uses: actions/cache@v4
           with:
             path: .turbo
             key: turbo-${{ runner.os }}-lint-${{ github.sha }}
             restore-keys: |
               turbo-${{ runner.os }}-lint-
         - run: pnpm lint
         - run: pnpm format:check

     typecheck:
       name: TypeScript
       runs-on: ubuntu-latest
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
         - name: Turbo cache
           uses: actions/cache@v4
           with:
             path: .turbo
             key: turbo-${{ runner.os }}-typecheck-${{ github.sha }}
             restore-keys: |
               turbo-${{ runner.os }}-typecheck-
         - run: pnpm typecheck

     test:
       name: Unit Tests
       runs-on: ubuntu-latest
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
         - name: Turbo cache
           uses: actions/cache@v4
           with:
             path: .turbo
             key: turbo-${{ runner.os }}-test-${{ github.sha }}
             restore-keys: |
               turbo-${{ runner.os }}-test-
         - run: pnpm test
   ```

2. **Добавить badge в README.md:**

   ```markdown
   [![CI](https://github.com/<owner>/volley-time-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/volley-time-platform/actions/workflows/ci.yml)
   ```

3. **Branch protection (через GitHub UI после первого зелёного билда):**
   - Settings → Branches → Add rule для `main`
   - Require status checks to pass: lint, typecheck, test, test:integration (3.8.2)
   - Require pull request before merging
   - Это делается **руками после первого зелёного билда**, не код-задача.

4. **`.github/dependabot.yml`** (опционально):
   ```yaml
   version: 2
   updates:
     - package-ecosystem: 'npm'
       directory: '/'
       schedule:
         interval: 'monthly'
     - package-ecosystem: 'github-actions'
       directory: '/'
       schedule:
         interval: 'monthly'
   ```

## Критерии приёмки

- ✅ Workflow создан в `.github/workflows/ci.yml`
- ✅ При push в `main` или PR — workflow стартует
- ✅ Все три job (lint, typecheck, test) выполняются параллельно
- ✅ Total время ≤ 3 минуты (с cache)
- ✅ Первый run — холодный cache, ~5 минут. Повторный — ≤ 2 минут (FULL TURBO для unchanged tasks)
- ✅ Если lint/typecheck/test падает — workflow красный
- ✅ Badge в README показывает текущий статус

## Подсказки

- **`pnpm/action-setup@v4`** — официальный action для pnpm. Версия 4 актуальна на 2026-05.
- **`actions/setup-node@v4 cache: 'pnpm'`** — кеширует pnpm store между runs. Экономит ~30 сек на install.
- **`concurrency.cancel-in-progress: true`** — при новом push в ту же ветку, предыдущий run отменяется. Экономит CI minutes.
- **`--frozen-lockfile`** — гарантирует, что `pnpm install` использует точно те версии из `pnpm-lock.yaml`, не обновляет.
- **Turbo cache key с `github.sha`** — каждый коммит свой, но `restore-keys` подтягивает предыдущий. Это даёт incremental caching.

## Не делать

- ❌ Не запускать Docker build — Phase 9
- ❌ Не делать deploy — Phase 9
- ❌ Не настраивать notifications в Slack/Telegram — Phase 14+
- ❌ Не покрывать всё matrix-стратегией (Node 18/20/22) — только Node 20 (наш target)
- ❌ Не использовать `npm` — workspace setup на pnpm
