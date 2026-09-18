---
id: '9.1'
phase: '9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Dockerfile для web и bot. Multi-stage, pnpm monorepo.'
estimated_hours: '2-3'
depends_on: ['8']
---

# Epic 9.1: Контейнеризация (Dockerfile web + bot)

**Цель.** Production Dockerfile для apps/web (Nuxt) и apps/bot (grammY). Multi-stage сборка, оптимизация размера, работа с pnpm monorepo.

## Контекст

Монорепо pnpm + Turborepo (Phase 3). Два деплоируемых приложения: web (Nuxt SSR) и bot (Node + grammY). Каждому — свой Dockerfile, собирающий только нужное из монорепо.

## Definition of Done

- Dockerfile.web: multi-stage (deps → build → runtime), Nuxt production build, минимальный runtime образ
- Dockerfile.bot: multi-stage, bot + internal notify endpoint
- pnpm workspace: правильная установка только нужных пакетов (не весь монорепо в каждый образ)
- .dockerignore (node_modules, .git, .env, dist)
- Образы собираются локально, запускаются
- Health endpoint доступен в web образе

## Задачи

| ID    | Задача                                    | Часов |
| ----- | ----------------------------------------- | ----: |
| 9.1.1 | Dockerfile.web (Nuxt multi-stage)         |   1-2 |
| 9.1.2 | Dockerfile.bot (grammY + internal notify) |     1 |

## Не делать

- ❌ Не класть весь монорепо в образ (только нужные пакеты)
- ❌ Не оставлять dev-зависимости в runtime
- ❌ Не хардкодить секреты в образ
