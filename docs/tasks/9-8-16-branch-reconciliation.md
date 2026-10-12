---
id: '9.8.16'
phase: '9'
epic: '9.8'
status: in_progress
release: 'v0.1.7'
last_reviewed: 2026-10-12
roles: [DEVOPS, QA]
depends_on: []
tags: [git, documentation, reconciliation]
---

# Task 9.8.16: сверка работ всех веток и main/prod

## Цель

Актуализировать main/prod с сохранением действительно не перенесённой работы; не повторять squash-merged или superseded изменения.

## Контекст

Пользователь запросил интеграцию работ из других веток. R0.7 принят, immutable v0.1.7 указывает на production e293e06; main92ec6f5 содержит последующее docs-only closure. Remote и local refs, а также tracked изменения всех worktrees нужно проверить до интеграции.

## Что должно быть сделано

1. Сверить ancestry, patch equivalence и merged PR exact heads всех веток. Для локальных replay-веток сравнить actual sources с принятым main и более поздними corrections; голый git cherry не доказывает отсутствующую функциональность.
2. Сохранить действительно пропущенные исторические SSH/recovery и R0.6 failed-deploy документы; пометить dated evidence как historical, не импортировать старый код/CI или stale current state.
3. Синхронизировать stale accepted metadata без claims неизвестного owner action. Review и docs gates, отдельный PR; актуализировать локальные main/prod с recoverable сохранением divergent main, не теряя user files.
4. После exact-head/main CI и reviewed FF обновить prod через Actions по deploy runbook; backup/exactSHA/health/smoke. Не переписывать v0.1.7, не запускать server-side build/pull. Финальная evidence отдельно от docs approval.

## Критерии приёмки

- Все local/remote branch tips классифицированы: ancestor, accepted PR head, accepted replay/superseded или missing. Tracked dirty worktrees проверены; untracked файлы не считаются автоматически готовой реализацией и не удаляются.
- Report объясняет каждую missing группу и не превращает исторический отказ в актуальный blocker. Product runtime/config patch отсутствует либо оформлен отдельной owning task с TDD.
- Сохранены SSH owner offline-key storage checkpoint и ограничения исходного evidence; provisioning не копирует/перезаписывает daily/recovery/CI authorized keys.
- Markdown formatting, links, independent review и exact-head/main CI проходят; local main/prod и remote promotion фиксируются с SHA и сохранением divergent refs.
- Actions deploy, pre-migration backup, exact live identity/smoke проверены; tag v0.1.7 immutable. Никакого prune/images/backups/data удаления.

## Подсказки

git cherry, exact PR head tree comparison, git worktree status; исходные branches chore/9.3.3-recovery-safe-ssh-access, trafficolog/docs/9.8.7-r06-production-candidate, main и trafficolog/test/9.8.13-heavy-shell-budgets. Deploy runbook.

## Не делать

Не bulk-merge старые ветки по отсутствию ancestry, не откатывать auth/pricing/rollback, не читать secrets, не очищать refs/worktrees/untracked files; published tags не переписываются. Историческая9.3.3 owner checkpoint не считается автоматически выполненной.
