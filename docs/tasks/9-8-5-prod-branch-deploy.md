---
id: '9.8.5'
phase: '9'
epic: '9.8'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'Prod-only workflow routing, manual source guard, promotion contract and live prod push deployment are verified.'
roles:
  - DEVOPS
  - QA
depends_on:
  - '9.8.3'
  - '9.8.4'
estimated_hours: '1'
tags:
  - deployment
  - github-actions
  - branches
  - production
---

# Task 9.8.5: production deploy только из ветки prod

## Цель

Разделить разработку и production-публикацию: GitHub-разработка и merge задач остаются в `main`, а автоматический production deploy и VPS checkout используют только `prod`.

## Контекст

Текущий workflow запускает production deploy при push в `main`, а local-build fallback обновляет checkout из `origin/main`. Это нарушает согласованную границу выпуска: в `prod` должны попадать только уже проверенные изменения из `main`.

## Что должно быть сделано

1. Автоматический `.github/workflows/deploy.yml` запускается при push только в `prod`; ручной запуск сохраняется.
2. `scripts/deploy-local-build.sh` fetch/checkout/pull выполняет для `origin/prod`.
3. Deploy runbook описывает promotion `task branch → main → prod`, запрет прямой разработки в `prod` и оба production-пути.
4. Контрактный тест фиксирует ветку-триггер, ветку local-build и содержание runbook.
5. Ручной `workflow_dispatch` отклоняет любой ref кроме `refs/heads/prod` до сборки образов, materialization секретов и SSH-действий.
6. Focused test и обязательный repository gate проходят до merge/promotion.

## Критерии приёмки

- [x] Push в `main` не запускает production deploy.
- [x] Push в `prod` запускает production workflow.
- [x] Ручной deploy разрешён только из `prod`; `main`, task-ветки и tags отклоняются source gate.
- [x] Local-build обновляется только из `origin/prod`.
- [x] Ручной `workflow_dispatch` и GHCR/local-build варианты сохранены.
- [x] Runbook явно описывает promotion и rollback.
- [x] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` проходят.

## Не делать

- Не переносить разработку задач из `main` в `prod`.
- Не деплоить непроверенный task branch напрямую на production.
- Не ослаблять smoke, migration или rollback gates.

## Production evidence — 2026-09-21

- Pushes to `prod` deployed automatically; manual runs `35513044804` and `35566144557` passed the prod source gate before tests, secret handling or SSH work.
- GitHub `main` remained the integration branch and production consumed only the promoted `prod` revision.
