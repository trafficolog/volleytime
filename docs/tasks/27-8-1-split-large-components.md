---
id: '27.8.1'
phase: '27'
epic: '27.8'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (UI-01). Релиз назначает владелец.'
ref_id: ''
review_ref: 'UI-01'
priority: P2
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['21.4.3']
supersedes: []
decisions: []
estimated_hours: '6-12'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, frontend, refactor]
---

# Task 27.8.1: Разделить крупнейшие компоненты формы и экрана события

## Цель

Форма события и экран события Mini App состоят из секций с отдельными composables и тестами.

## Контекст

- Замечание `UI-01` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** 140 файлов `.vue`; `apps/web/app/components/EventForm.vue` и `apps/web/app/pages/m/orgs/[orgId]/events/[eventId]/index.vue` больше 40 КБ.
- Поведение фиксировано существующими тестами и визуальной сверкой 19.0.2.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (в форме события цены и способы оплаты); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Характеризационные тесты на текущее поведение (если покрытия не хватает) — до рефакторинга.
2. Разбить на секции (основное, цена, серия, запись, приглашения) и composables с логикой.
3. Визуальная сверка 19.0.2 до и после — без различий.

## Критерии приёмки

- ✅ Ни один из двух файлов не больше 15 КБ
- ✅ Тесты и визуальная сверка без изменений
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять поведение
