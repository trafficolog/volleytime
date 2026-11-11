---
id: '27.2.1'
phase: '27'
epic: '27.2'
status: in_progress
release: 'v0.3.1'
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (CI-01). Релиз v0.3.1 (решение владельца 2026-11-10), параллельно с эпиками 21.4–21.5. Реализация в PR, ждёт ревью и секрета VPS_KNOWN_HOSTS от владельца.'
ref_id: ''
review_ref: 'CI-01'
priority: P1
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '3-6'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, ci, supply-chain]
---

# Task 27.2.1: Actions по SHA, отпечаток хоста VPS и минимальные права токена

## Цель

Workflows не зависят от изменяемых тегов сторонних actions, а SSH к VPS проверяет хост.

## Контекст

- Замечание `CI-01` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `.github/workflows/*.yml` закрепляют actions тегом, включая `appleboy/ssh-action@v1` и `appleboy/scp-action@v1`, которым передаётся `VPS_SSH_KEY`; отпечаток хоста не задан; у большинства job нет `permissions`.
- Promote и deploy — [9.8.17](9-8-17-gated-prod-promotion.md); правки workflows в диапазоне ломают Promote без `PROMOTE_TOKEN` (см. [27.2.4](27-2-4-promotion-path.md)).
- Новый секрет с отпечатком хоста добавляет владелец.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (по правилам ORCHESTRATION для этой области); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Закрепить каждый `uses:` по полному SHA с комментарием версии.
2. Заменить `appleboy/*` на `ssh`/`scp` runner с `known_hosts` из секрета (предпочтительно) либо задать `fingerprint`; описать, как владельцу получить отпечаток.
3. Верхнеуровневый `permissions: contents: read` в каждом workflow, расширения — только в нужных job.
4. Проверка: actionlint или существующий тест workflows; прогон CI на PR.
5. Инструкция владельцу: какой секрет добавить и где.

## Критерии приёмки

- ✅ Ни одного `uses:` по тегу или ветке
- ✅ SSH к VPS падает при неверном отпечатке (проверка на тестовом значении в PR или описанный ручной шаг)
- ✅ Каждый workflow имеет явный `permissions`
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять шаги выкладки по сути
- ❌ Не запускать deploy для проверки без подтверждения владельца
