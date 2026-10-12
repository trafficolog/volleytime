---
id: '25.1.5'
phase: '25'
epic: '25.1'
status: todo
release: 'v0.6.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: ''
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [QA, PRODUCT]
depends_on: ['25.1.1', '25.1.2', '25.1.3', '25.1.4', '23.1.2']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [reference-v3]
---

# Task 25.1.5: Релиз v0.6.0: решение по гипотезам волны 1

## Цель

Выкатить волну 1 за флагами и принять решения по метрикам.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** —
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. QA, Promote, тег v0.6.0
2. Через период наблюдения — решение по каждой гипотезе (оставить/убрать) по метрикам 23.1.2

## Критерии приёмки

- ✅ Решения записаны в журнал решений
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
