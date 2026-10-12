---
id: '21.2.4'
phase: '21'
epic: '21.2'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: 'Поглощает фазу 11 в объёме макетов.'
ref_id: ''
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, DB]
depends_on: ['19.2.1', '19.3.1']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: ''
  screens: []
tags: [reference-v3]
---

# Task 21.2.4: Сборы: домен, API и касса

## Цель

Серверная модель сборов вне событий: сбор, взносы, подтверждение, попадание в кассу.

## Контекст

- Задача добавлена оркестратором при перепланировании v3: в списке задач референса её нет, но она нужна для экранов или выпуска.
- **Как есть (main `e68acf2`):** Только категория ledger `contribution` (ручной доход). Фаза 11 — скелет.
- **Дельта до референса:** Новый домен.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (ревью Opus + тесты граничных случаев и гонок); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Схема и миграция по ADR 19.2.1
2. API: CRUD сбора (организатор), список и взнос (игрок), подтверждение/отклонение взноса
3. Подтверждённый взнос → ledger `contribution`; права и аудит
4. Integration-тесты, включая гонки подтверждения

## Критерии приёмки

- ✅ Сумма подтверждённых взносов = поступления кассы по сбору
- ✅ Игрок не видит сборы чужой группы (IDOR)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important
- ✅ RED→GREEN тесты на граничные случаи, деньги/доступ и конкурентность приложены к PR

## Подсказки

- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.
- Меняет модель данных: схема и контракт по ADR [19.2.1](19-2-1-domain-model.md) до UI; миграция forward-compatible (deploy runbook).

## Не делать

- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
