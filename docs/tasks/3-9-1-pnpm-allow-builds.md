---
id: '3.9.1'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · P0 #4'
priority: P0
roles:
  - DEVOPS
depends_on: []
estimated_hours: '0.5'
tags:
  - pnpm
  - ci
  - review-fix
---

# Task 3.9.1: pnpm install --frozen-lockfile падает (allowBuilds плейсхолдер)

## Цель

Сделать `pnpm install --frozen-lockfile` рабочим локально, в CI и в Docker.

## Контекст

В `pnpm-workspace.yaml` остался плейсхолдер `allowBuilds: esbuild: set this to true or false`. pnpm 12 трактует это как неразрешённый билд-скрипт → `ERR_PNPM_IGNORED_BUILDS`, exit 1. Из-за этого падают CI (3.8), deploy (9.8) и Docker deps-стадии (9.1).

## Что должно быть сделано

1. В `pnpm-workspace.yaml`:

   ```yaml
   allowBuilds:
     esbuild: true
   ```

2. Проверить: `pnpm install --frozen-lockfile` → exit 0, postinstall `esbuild` выполнен.

## Критерии приёмки

- ✅ `pnpm install --frozen-lockfile` → exit 0 на чистом клоне
- ✅ Нет предупреждения `ERR_PNPM_IGNORED_BUILDS`

## Подсказки

- Перенос `pnpm.overrides` в workspace-файл — отдельная находка Phase 9 (задача 9.9.8).

## Не делать

- ❌ Не использовать `--ignore-scripts` в CI как обход — esbuild нужен бинарник
