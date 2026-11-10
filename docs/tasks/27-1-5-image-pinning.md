---
id: '27.1.5'
phase: '27'
epic: '27.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (INF-04). Релиз назначает владелец.'
ref_id: ''
review_ref: 'INF-04'
priority: P2
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [DEVOPS]
depends_on: ['27.2.2']
supersedes: []
decisions: []
estimated_hours: '3-6'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, docker, supply-chain]
---

# Task 27.1.5: Закрепить базовые образы по digest и облегчить runtime-образ бота

## Цель

Базовые образы закреплены по digest и обновляются автоматическими PR; образ бота не несёт dev-зависимостей.

## Контекст

- Замечание `INF-04` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `node:22-alpine`, `caddy:2-alpine`, `postgres:16-alpine` без digest; runtime бота копирует полный `node_modules`.
- Автообновление digest — через dependabot из [27.2.2](27-2-2-security-scanning.md).
- Изменение выкладки проверяется по [deploy runbook](../operations/runbooks/deploy.md); в production попадает только через релизную задачу и Promote с подтверждением владельца.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (по правилам ORCHESTRATION для этой области); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Закрепить digest во всех Dockerfile и compose (тег оставить в комментарии для читаемости).
2. Бот: production-установка (`pnpm deploy --prod` или эквивалент) в runtime-стадии; сравнить размер образа до и после.
3. Проверка упаковки бота (существующий тест образа или новый): запуск и health без сети.
4. Dependabot `docker` для каталогов с Dockerfile.

## Критерии приёмки

- ✅ Все базовые образы закреплены по digest
- ✅ Образ бота не содержит dev-зависимостей и работает офлайн; размер в PR
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять мажорные версии Node и Postgres
- ❌ Не менять lockfile вне необходимого
