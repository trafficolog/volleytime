---
id: '9.8.5'
phase: '9'
epic: '9.8'
status: in_progress
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Repository implementation is rebased onto current main and includes an explicit prod-only source guard for manual dispatch. Final repository verification and live production acceptance remain pending.'
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

- [ ] Push в `main` не запускает production deploy.
- [ ] Push в `prod` запускает production workflow.
- [ ] Ручной deploy разрешён только из `prod`; `main`, task-ветки и tags отклоняются source gate.
- [ ] Local-build обновляется только из `origin/prod`.
- [ ] Ручной `workflow_dispatch` и GHCR/local-build варианты сохранены.
- [ ] Runbook явно описывает promotion и rollback.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` проходят.

## Не делать

- Не переносить разработку задач из `main` в `prod`.
- Не деплоить непроверенный task branch напрямую на production.
- Не ослаблять smoke, migration или rollback gates.
