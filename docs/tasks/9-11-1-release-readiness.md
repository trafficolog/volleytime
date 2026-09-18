---
id: '9.11.1'
phase: '9'
epic: '9.11'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Done 2026-09-18: canonical GitHub опубликован, PR #1 получил green CI, release-readiness evidence зафиксирован; production/manual gates намеренно остаются открытыми и не считаются выполненными.'
roles:
  - DEVOPS
  - QA
  - SECURITY
  - DOCS
depends_on:
  - '3.10.1'
  - '5.14.1'
  - '6.9.1'
  - '8.9.1'
  - '9.10.4'
estimated_hours: '3-6'
tags:
  - release
  - github
  - documentation
  - qa
---

# Task 9.11.1: Release readiness и GitHub publication

## Цель

Подготовить существующий `v0.1.2` MVP к первому каноническому GitHub/production release-gate без изменения продуктового scope.

## Контекст

После повторного ревью все repository-level P1/P2 были закрыты в `v0.1.2`, но `README.md` и часть `current-state.md` сохранили дореализационный текст («реализация — следующий шаг», Phase 3 todo, GitHub не создан). При этом реальный Telegram QA и первый VPS deploy по документации остаются внешними gate и не должны объявляться закрытыми.

GitHub-репозиторий `trafficolog/volleytime` существует, но до этой задачи содержит только начальный README; источник реализации — предоставленный Git-архив.

## Что должно быть сделано

1. Синхронизировать `README.md`, `docs/operations/status/current-state.md` и `docs/RELEASES.md` с фактическим состоянием `v0.1.2`.
2. Добавить минимальный набор корневой эксплуатационной документации: `AGENTS.md`, `CHANGELOG.md`, `SECURITY.md`.
3. Выполнить release-readiness review: SDD traceability, auth/tenant/payment/webhook/deploy boundaries, UI/flow coverage относительно Claude Design export.
4. Опубликовать release candidate в `trafficolog/volleytime` отдельной веткой/PR.
5. Использовать GitHub Actions как свежий воспроизводимый gate: format, lint, typecheck, tests, build.
6. Не изменять существующий `v0.1.2`; при необходимости patch-release использовать `v0.1.3`.

## Критерии приёмки

- ✅ Root README больше не утверждает, что реализация не начата.
- ✅ `current-state.md` не содержит взаимоисключающих статусов MVP-фаз.
- ✅ Ясно разделены code-complete, release-candidate и production-validated состояния.
- ✅ Telegram QA, первый deploy, backup/monitoring и неделя реального использования остаются открытыми до фактического подтверждения.
- ✅ Release-readiness report содержит проверенные repository findings и внешние gate.
- ✅ GitHub CI release candidate проходит либо отчёт содержит конкретный незакрытый blocker с evidence.
- ✅ Phase 10+ не реализуется в рамках задачи.

## Подсказки

- `docs/operations/reviews/2026-09-18-v0.1.1-rereview.md` — исходная база повторного ревью.
- Claude Design ZIP — reference интерфейсов, не источник domain/business logic.
- Production DoD из `docs/RELEASES.md` строже локального CI: deployment и реальная эксплуатация проверяются отдельно.

## Не делать

- ❌ Не объявлять MVP production-ready только потому, что CI зелёный.
- ❌ Не переписывать существующий тег `v0.1.2`.
- ❌ Не внедрять Phase 10, 7, 15 или модули 11-18.
- ❌ Не добавлять зависимости или инфраструктуру, не требуемые release-gate.
