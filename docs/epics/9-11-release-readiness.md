---
id: '9.11'
phase: '9'
status: done
release: 'v0.1.3'
---

# Epic 9.11: Release readiness и публикация репозитория

## Цель

Устранить drift release-документации после `v0.1.2`, опубликовать актуальный MVP-код в канонический GitHub-репозиторий и получить воспроизводимый CI release-gate перед первым production deploy.

## Scope

- синхронизация статуса и корневой документации;
- повторный release-readiness review без расширения MVP scope;
- публикация release candidate в `trafficolog/volleytime`;
- CI: format, lint, typecheck, unit/integration tests, build;
- фиксация внешних gate: Telegram QA, VPS deploy, backup/monitoring и реальная неделя эксплуатации.

## Задачи

- [9.11.1 Release readiness и GitHub publication](../tasks/9-11-1-release-readiness.md)
- [9.11.2 SDD reconciliation перед v0.1.3](../tasks/9-11-2-sdd-reconciliation.md)
