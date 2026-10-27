---
id: '22.3.2'
phase: '22'
epic: '22.3'
status: todo
release: 'v0.4.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: ''
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [QA, DEVOPS, SECURITY]
depends_on:
  [
    '22.1.1',
    '22.1.2',
    '22.1.3',
    '22.1.4',
    '22.2.1',
    '22.2.2',
    '22.2.3',
    '22.3.1',
    '21.3.1',
    '21.4.3',
  ]
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [reference-v3]
---

# Task 22.3.2: Релиз v0.4.0: QA, выкладка и приёмка Root Admin

## Цель

Принять v0.4.0: Root Admin в production.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** —
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Пять gates, отчёт 19.0.2 по `4b-root-admin`
2. Проверка доступа: все root-маршруты закрыты для не-root
3. Promote, backup, smoke, тег v0.4.0

## Критерии приёмки

- ✅ Все root-действия в журнале
- ✅ Production health = release SHA
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
