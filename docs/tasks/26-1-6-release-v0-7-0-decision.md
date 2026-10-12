---
id: '26.1.6'
phase: '26'
epic: '26.1'
status: todo
release: 'v0.7.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: ''
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [QA, PRODUCT]
depends_on: ['26.1.1', '26.1.2', '26.1.3', '26.1.4', '26.1.5']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [reference-v3]
---

# Task 26.1.6: Релиз v0.7.0: решение по гипотезам волны 2

## Цель

Выкатить волну 2 за флагами и принять решения по метрикам.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** —
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. QA, Promote, тег v0.7.0
2. Решение по каждой гипотезе

## Критерии приёмки

- ✅ Решения записаны в журнал решений
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
