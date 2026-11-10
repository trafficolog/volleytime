---
id: '27.9.7'
phase: '27'
epic: '27.9'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (PROD-07). Релиз назначает владелец.'
ref_id: ''
review_ref: 'PROD-07'
priority: P2
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [TECHNICAL_WRITER]
depends_on: ['21.5.5']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, docs]
---

# Task 27.9.7: Короткий current-state и правило «новая запись заменяет старую»

## Цель

Статус проекта читается за минуту: одна страница текущего состояния, история — в архиве.

## Контекст

- Замечание `PROD-07` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Перенос исторических баннеров делает [21.5.5](21-5-5-legacy-history-condense.md); эта карточка задаёт форму и правило после неё.
- Сводка `current-state.md` «Last generated» — 2026-09-21; 468 карточек задач.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (безопасность или доступ); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Форма `current-state.md`: production, main, флаги, открытые блокеры, следующий шаг — не больше одной страницы.
2. Правило в DEVELOPMENT_PROCESS: новая запись статуса заменяет предыдущую, история — в `docs/operations/status/archive/<релиз>.md`.
3. Проверка ссылок после правки.

## Критерии приёмки

- ✅ `current-state.md` не длиннее 60 строк, ссылки целы
- ✅ Правило записано
- ✅ Ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не удалять evidence — только переносить
