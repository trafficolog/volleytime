---
id: '27.5.5'
phase: '27'
epic: '27.5'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (OPS-04). Релиз назначает владелец.'
ref_id: ''
review_ref: 'OPS-04'
priority: P3
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '2-6'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, ops, scheduler, concurrency]
---

# Task 27.5.5: Планировщик: защита от двух экземпляров

## Цель

Две копии web (при выкладке или ошибке) не выполняют одни и те же задачи планировщика дважды.

## Контекст

- Замечание `OPS-04` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Планировщик работает в процессе web (`SCHEDULER_ENABLED`, интервал 15 с): открытие и закрытие записи, финализация split, напоминания.
- Проверить, есть ли уже advisory lock или `SELECT … FOR UPDATE SKIP LOCKED` в задачах.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Описать текущую защиту от параллельного запуска по коду.
2. Если её нет: advisory lock на тик планировщика (или на каждую задачу) с тестом.
3. Тест: два параллельных тика → каждая задача выполнена один раз (особенно денежные).

## Критерии приёмки

- ✅ Параллельные тики не дублируют действия (тест, в том числе финализация split)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не вводить внешнюю очередь
