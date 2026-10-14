---
id: '21.3.1'
phase: '21'
epic: '21.3'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: ''
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [QA, DEVOPS]
depends_on:
  [
    '21.1.1',
    '21.1.2',
    '21.1.3',
    '21.1.4',
    '21.1.5',
    '21.1.6',
    '21.1.7',
    '21.2.1',
    '21.2.2',
    '21.2.3',
    '21.2.4',
    '21.2.5',
    '21.2.6',
    '21.2.7',
    '21.2.8',
    '21.2.9',
    '21.2.10',
    '20.7.1',
  ]
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: ''
  screens: []
tags: [reference-v3]
---

# Task 21.3.1: Релиз v0.3.0: сквозная QA, выкладка и приёмка MVP организатора

## Цель

Принять v0.3.0 — MVP Mini App и кабинета организатора по референсу.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** —
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Пять gates, отчёт 19.0.2 по всем экранам Mini App и кабинета
2. Telegram QA на двух аккаунтах
3. Promote, backup, smoke, тег v0.3.0

## Критерии приёмки

- ✅ Все экраны `3-miniapp-*` и `4-cabinet` покрыты задачами done или явно отложены
- ✅ Production health = release SHA
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
