---
id: '3.1'
phase: '3'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Базовая структура монорепозитория. Без неё ничего не запустится.'
estimated_hours: '4-5'
---

# Epic 3.1: Monorepo init

**Цель.** Создать монорепозиторий с pnpm workspaces + Turborepo, настроить базовые конфиги (TypeScript strict, ESLint flat config, Prettier), задать общую структуру `apps/`, `packages/`.

## Контекст

Это **самый первый код** в новой кодовой базе. Из коробки решает: где лежат пакеты, как они зависят, как собираются. Если сделать криво — каждая следующая фаза будет страдать.

Решения утверждены в phase-card:

- Turborepo поверх pnpm workspaces (для кеширования)
- ESLint flat config (`eslint.config.js`, не `.eslintrc.json`)
- TypeScript strict с первого дня

## Definition of Done

- Корневой `package.json` с `workspaces` и общими scripts
- `pnpm-workspace.yaml` указывает на `apps/*` и `packages/*`
- `turbo.json` с тасками `build`, `dev`, `test`, `lint`, `typecheck`
- `tsconfig.base.json` с strict mode для наследования
- `eslint.config.js` flat config + Prettier integration
- `.prettierrc.json` с базовыми правилами
- `.gitignore` корректный (включает `node_modules`, `.turbo`, `dist`, `.env*`)
- `pnpm install` работает без ошибок
- `pnpm typecheck` проходит (пока без файлов — должно проходить тривиально)
- `pnpm lint` проходит

## Задачи

| ID                                                    | Задача                                     | Часов |
| ----------------------------------------------------- | ------------------------------------------ | ----: |
| [3.1.1](../tasks/3-1-1-pnpm-workspaces-init.md)       | pnpm workspaces + структура папок          |   1-2 |
| [3.1.2](../tasks/3-1-2-turborepo-config.md)           | Turborepo с базовыми pipelines             |   1-2 |
| [3.1.3](../tasks/3-1-3-typescript-eslint-prettier.md) | TypeScript strict + ESLint flat + Prettier |     2 |

## Не делать

- ❌ Не создавать сами пакеты (`packages/db`, `apps/web` и т.д.) — это другие эпики
- ❌ Не настраивать CI — Epic 3.8
- ❌ Не подключать Docker — Epic 3.6
- ❌ Не добавлять husky / lint-staged — лишнее в Phase 3 (можно в Phase 9)
