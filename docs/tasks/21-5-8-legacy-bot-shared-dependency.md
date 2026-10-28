---
id: '21.5.8'
phase: '21'
epic: '21.5'
status: todo
release: 'v0.3.1'
sync_state: synced
last_reviewed: 2026-10-28
status_note: 'Решение владельца OQ-6 (2026-10-28): удалить зависимость @volley-time/shared у бота; согласие на изменение pnpm-lock.yaml дано этим решением. Пакет из отчёта 21.5.1: LEG-24. Отдельный PR, чтобы diff lockfile был читаемым.'
ref_id: ''
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS, BACK]
depends_on: ['21.5.1', '21.3.1']
supersedes: []
decisions: []
estimated_hours: '2-6'
reference:
  spec: ''
  screens: []
tags: [reference-v3, cleanup, dependencies]
---

# Task 21.5.8: Удаление наследия, зависимость бота `@volley-time/shared`

## Цель

Убрать неиспользуемую зависимость `@volley-time/shared` из `apps/bot` вместе с записью bot→shared в `pnpm-lock.yaml` (Dockerfile не меняется) (`LEG-24` принятого отчёта [21.5.1](../operations/reviews/2026-10-28-legacy-inventory.md)).

## Контекст

- Решение владельца **OQ-6** ([журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md), запись 2026-10-28): удалить; согласие на изменение lockfile — это решение. Пакет отдельный (или как минимум отдельный коммит lockfile), чтобы diff `pnpm-lock.yaml` проверялся независимо.
- Доказательство: `rg -n "@volley-time/" apps/bot --glob '!node_modules' --glob '!package.json'` → 0 импортов; бот обращается к web по HTTP (`apps/bot/src/web-client.ts`). Записи: `apps/bot/package.json:15` и importer `apps/bot` в `pnpm-lock.yaml` (`link:../../packages/shared`).
- `apps/bot/Dockerfile` **не меняется**: строка `COPY packages/shared/package.json` (строка 11) нужна, потому что Dockerfile копирует манифест `packages/core`, а тот объявляет `@volley-time/shared` (`packages/core/package.json:20`). Остальные `COPY` манифестов тоже остаются.
- Проверка сборки: CI-задача `image-bundle` (`scripts/validate-runner-images.sh`) собирает образы; образ бота должен собираться с `pnpm install --frozen-lockfile`.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` с проверкой diff lockfile; маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Повторить поиск импортов `@volley-time/shared` в `apps/bot` (включая тесты и `tsup`/`tsconfig`); если импорт появился, остановиться и вернуть задачу оркестратору.
2. Удалить зависимость из `apps/bot/package.json`; обновить `pnpm-lock.yaml` командой `pnpm install --lockfile-only` без прочих изменений версий; проверить `git diff pnpm-lock.yaml` — удалена только запись bot→shared.
3. Не трогать `apps/bot/Dockerfile`; `packages/shared` остаётся в workspace (его используют web и core).
4. Проверить `pnpm install --frozen-lockfile`, `pnpm -F @volley-time/bot typecheck`, `build`, `test` и сборку образа бота (локально `docker build -f apps/bot/Dockerfile .` либо CI `image-bundle`).
5. Обновить отчёт аудита: статус `LEG-24` — удалено + номер PR.

## Критерии приёмки

- ✅ Diff содержит только `apps/bot/package.json`, `pnpm-lock.yaml` (запись bot→shared) и отчёт аудита; `apps/bot/Dockerfile` не изменён
- ✅ `pnpm install --frozen-lockfile` проходит; образ бота собирается в CI (`image-bundle` зелёный)
- ✅ Пять gates на tested revision; число тестов не изменилось
- ✅ Версии остальных зависимостей в lockfile не изменились
- ✅ Ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не удалять `packages/shared` из workspace и не трогать зависимости web и core
- ❌ Не обновлять версии пакетов и не менять `apps/bot/Dockerfile` (в том числе `COPY` манифестов `shared`, `db`, `core`)
- ❌ Не менять workflows, production-конфигурацию, данные и миграции
