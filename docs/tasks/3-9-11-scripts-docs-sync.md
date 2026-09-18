---
id: '3.9.11'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · P2 #11'
priority: P2
roles:
  - DEVOPS
  - DOCS
depends_on:
  - '3.9.5'
estimated_hours: '2-3'
tags:
  - dx
  - docs
  - review-fix
---

# Task 3.9.11: test:integration, db:rollback, setup.sh, мёртвый app.vue, версии vitest, статусы документации

## Цель

Привести скрипты и документацию Phase 3 к DoD и фактическому состоянию.

## Контекст

Нет `test:integration`, `db:rollback`, `scripts/setup.sh`; `apps/web/app.vue` не используется (Nuxt 4 берёт `app/`); vitest 4 и 5 одновременно; статусы карточек `todo` у реализованных задач.

## Что должно быть сделано

1. `test:integration` — `vitest run --project integration` (файлы `*.integration.test.ts`); `test:unit` — остальные.
2. `db:rollback` — скрипт `packages/db/src/rollback.ts`: откат последней миграции по `down`-SQL из `migrations/rollback/NNNN.sql` (drizzle не генерирует down); для новых миграций фикса — down-файлы обязательны.
3. `scripts/setup.sh`: проверка node/pnpm, `pnpm install`, `cp .env.example .env`, `docker compose up -d`, миграции dev+test.
4. Удалить `apps/web/app.vue`; выровнять `vitest` на одну мажорную версию.
5. Синхронизировать frontmatter карточек Phase 3–9 (`status`, `status_note` со ссылкой на фикс-задачи); обновить `current-state.md`, README quickstart.

## Критерии приёмки

- ✅ `pnpm test:integration` и `pnpm db:rollback` существуют и работают
- ✅ `scripts/setup.sh` поднимает окружение с нуля
- ✅ Один мажор vitest в lockfile
- ✅ Статусы карточек соответствуют ревью

## Подсказки

- Для rollback достаточно down-скриптов к миграциям фикса; исторические миграции откатываются через restore из бэкапа (runbook).

## Не делать

- ❌ Не переписывать исторические миграции
