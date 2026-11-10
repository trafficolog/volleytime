---
id: '27.8.2'
phase: '27'
epic: '27.8'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (UI-02). Релиз назначает владелец.'
ref_id: ''
review_ref: 'UI-02'
priority: P2
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['27.8.1']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, frontend, refactor, architecture]
---

# Task 27.8.2: Общая логика кабинета и Mini App для событий, оплат и кассы

## Цель

Правило, расчёт или форматирование для организатора живёт в одном месте и одинаково в кабинете и Mini App.

## Контекст

- Замечание `UI-02` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Кабинет `/app/**` и Mini App `/m/**` повторяют экраны организатора; требование v0.3.0 — «цифры денег совпадают между Mini App, кабинетом и кассой».
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (архитектура клиента и деньги); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Инвентаризация дублей (поиск похожих функций, форматирования денег и дат, валидаций) — таблица в PR.
2. Вынести общее в `app/utils` или composables с тестами; страницы используют общее.
3. Тест сверки: одни данные — одинаковые суммы в обоих интерфейсах.

## Критерии приёмки

- ✅ Дубли из таблицы устранены
- ✅ Тест сверки сумм проходит
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не объединять сами страницы и layout
