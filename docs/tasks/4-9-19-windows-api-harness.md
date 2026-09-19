---
id: '4.9.19'
phase: '4'
epic: '4.9'
status: done
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Fixed with separator-normalizing route helper; focused tests, 380-test suite, lint, typecheck and build pass on Windows.'
roles:
  - BACKEND
  - QA
depends_on:
  - '4.9.15'
estimated_hours: '1-2'
tags:
  - testing
  - windows
  - api
---

# Task 4.9.19: переносимый API test harness

## Цель

Сделать преобразование файловых Nitro-маршрутов в тестовом HTTP-harness независимым от разделителя путей ОС, чтобы один и тот же integration suite проходил на Windows и Linux.

## Контекст

`path.relative()` возвращает `\` на Windows. Текущий parser в `apps/web/server/__tests__/harness.ts` разбирает только `/`, поэтому регистрирует маршруты вида `/api/organizations\[orgId]\index`; все запросы к обычным URL получают 404. На Linux CI ошибка скрыта, потому что разделитель там `/`.

## Что должно быть сделано

1. Выделить чистое преобразование относительного имени route-файла в method + URL.
2. Нормализовать оба поддерживаемых разделителя (`/` и `\`) до разбора сегментов.
3. Использовать этот helper при регистрации реальных API handlers в harness.
4. Зафиксировать Windows и POSIX варианты отдельными unit-тестами.

## Критерии приёмки

- ✅ `organizations/[orgId]/index.get.ts` преобразуется в `GET /api/organizations/:orgId`.
- ✅ `organizations\[orgId]\index.get.ts` даёт тот же результат.
- ✅ Динамические и вложенные segments не теряются.
- ✅ Phase 4/5 API security integration tests больше не получают ложные 404 из-за ОС.
- ✅ Полный `pnpm test` проходит с PostgreSQL.

## Не делать

- ❌ Не менять production API handlers или их контракты.
- ❌ Не ослаблять security assertions ради зелёных тестов.
- ❌ Не добавлять OS-specific ветвление в каждый тест.
