---
id: '27.8.6'
phase: '27'
epic: '27.8'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (UI-06). Релиз назначает владелец.'
ref_id: ''
review_ref: 'UI-06'
priority: P3
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['21.4.3']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, frontend, resilience]
---

# Task 27.8.6: Единый компонент «ошибка, повторить» для списков

## Цель

Ошибка загрузки любого списка показывает ошибку с повтором, а не пустое состояние.

## Контекст

- Замечание `UI-06` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- В R0.6 найден ложный пустой список при 503 ([8.10.6](8-10-6-miniapp-invite-load-retry.md)).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (стандартное ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Найти списки без отдельного состояния ошибки (таблица в PR).
2. Общий компонент или composable `useLoadState` и перевод списков на него.
3. Тест-шаблон: 503 → ошибка и «Повторить» → данные.

## Критерии приёмки

- ✅ Каждый список из таблицы показывает ошибку и повтор (тесты)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Не делать

- ❌ Не менять тексты пустых состояний
