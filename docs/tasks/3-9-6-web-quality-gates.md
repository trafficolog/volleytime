---
id: '3.9.6'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · P1 #6'
priority: P1
roles:
  - FE
  - QA
depends_on:
  - '3.9.1'
estimated_hours: '3-4'
tags:
  - typecheck
  - eslint
  - vitest
  - review-fix
---

# Task 3.9.6: Web-слой под проверками: vue-tsc, eslint-plugin-vue, vitest для apps/web

## Цель

Сделать так, чтобы ошибки типов, линта и логики в `apps/web` ловились CI.

## Контекст

`typecheck` = `nuxt prepare` (типы не проверяются), ESLint не видит `.vue`, vitest не включает `apps/web`. Утверждение «build проверяет типы» неверно — esbuild вырезает типы. Поэтому 263 зелёных теста не поймали ни одной находки web-слоя.

## Что должно быть сделано

1. Обновить `vue-tsc` до версии, совместимой с Nuxt 4.5 (`^3`), `typecheck: nuxt typecheck`; удалить `TYPECHECK_NOTE.md`.
2. `eslint-plugin-vue` + `vue-eslint-parser` во flat-конфиге для `**/*.vue`.
3. `vitest.config.ts`: `include` + `apps/web/server/**/*.test.ts`, `apps/web/app/**/*.test.ts`.
4. Первые тесты web: `readServerEnv` (3.9.2), `tenant` path-парсер, `labels` форматирование.

## Критерии приёмки

- ✅ `pnpm typecheck` падает на намеренной ошибке типа в `.vue`
- ✅ `pnpm lint` линтит `.vue`
- ✅ `pnpm test` запускает тесты из `apps/web`

## Подсказки

- Если `nuxt typecheck` конфликтует с volar-плагином vue-router — пинуть совместимую пару версий, не отключать проверку.

## Не делать

- ❌ Не выключать правила линтера ради зелёного CI
