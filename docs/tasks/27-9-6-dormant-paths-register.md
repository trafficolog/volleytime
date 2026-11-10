---
id: '27.9.6'
phase: '27'
epic: '27.9'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (PROD-06). Релиз назначает владелец.'
ref_id: ''
review_ref: 'PROD-06'
priority: P3
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: owner
roles: [PRODUCT, FULLSTACK]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '1-3'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, product, cleanup, flags]
---

# Task 27.9.6: Реестр выключенных путей со сроком решения

## Цель

У каждого выключенного флага и неиспользуемой роли есть владелец решения и срок «включить или удалить».

## Контекст

- Замечание `PROD-06` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Известные: Login Widget ([27.3.6](27-3-6-login-widget-decision.md)), роль `assistant` ([27.7.1](27-7-1-assistant-role.md)), `COLLECTIONS_ENABLED`; Python-прототип удаляет [21.5.6](21-5-6-legacy-python-prototype.md).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (итог принимает владелец); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Найти все флаги окружения и их состояние в production (по runbook и current-state), роли и маршруты без использования.
2. Таблица в `docs/operations/status/flags.md`: флаг, состояние, срок решения, карточка.

## Критерии приёмки

- ✅ Реестр создан, у каждой строки есть срок и карточка или решение
- ✅ Ревью `claude-opus-5-5` без Critical/Important; итог принят владельцем

## Не делать

- ❌ Не удалять код в этой карточке
