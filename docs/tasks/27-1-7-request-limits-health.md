---
id: '27.1.7'
phase: '27'
epic: '27.1'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (INF-08). Релиз назначает владелец.'
ref_id: ''
review_ref: 'INF-08'
priority: P3
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [BACK, DEVOPS]
depends_on: ['27.4.1']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, bot, health]
---

# Task 27.1.7: Ограничение тела запросов бота и раскрытие версии в health

## Цель

Внутренний сервер бота не читает тела без предела; публичный health не нагружает БД без лимита и не раскрывает лишнего.

## Контекст

- Замечание `INF-08` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `apps/bot/src/internal-server.ts` читает тело без ограничения; `healthz` бота и `/api/health` отдают SHA релиза; `/api/health` делает три запроса к БД и не ограничен лимитером.
- SHA в health использует deploy и smoke для сверки релиза — его нельзя просто убрать.
- Лимитер — из [27.4.1](27-4-1-rate-limits.md).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (по правилам ORCHESTRATION для этой области); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Предел тела 64 КБ для `/internal/notify` (413 сверх), тест.
2. Лимит запросов на `/api/health` по IP.
3. Решить и реализовать: SHA только при служебном секрете либо оставить публичным с записью причины (выбор согласовать с ревьюером).
4. Обновить smoke и runbook, если изменился ответ health.

## Критерии приёмки

- ✅ Тело больше предела получает 413 (тест)
- ✅ Health ограничен лимитером; deploy и smoke сверяют релиз как раньше
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не ломать сверку релиза в deploy
