---
id: '27.5.3'
phase: '27'
epic: '27.5'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (OPS-02). Релиз назначает владелец.'
ref_id: ''
review_ref: 'OPS-02'
priority: P2
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: owner
roles: [DEVOPS, QA]
depends_on: ['27.5.1']
supersedes: []
decisions: []
estimated_hours: '3-6'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, ops, rollback]
---

# Task 27.5.3: Учебный откат на предыдущий релиз v3

## Цель

Путь отката проверен на практике, а закреплённый релиз для отката актуален.

## Контекст

- Замечание `OPS-02` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Откат не исполнялся после v0.2.0; после включения флагов откат на `b056806` отказывает, восстановление только вперёд ([current-state](../operations/status/current-state.md)).
- Rollback guard и runbook — [deploy](../operations/runbooks/deploy.md).
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (действие на production только с владельцем); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Определить целевой релиз для отката (последний совместимый по данным) и снять пин `b056806` отдельным шагом.
2. Репетиция на копии production в изолированном окружении (восстановленный бэкап) — без касания production.
3. По решению владельца — учебный откат на production в окно низкой нагрузки и возврат вперёд.
4. Обновить runbook по результатам.

## Критерии приёмки

- ✅ Откат выполнен минимум на копии; время и шаги записаны
- ✅ Пин отката указывает на совместимый релиз
- ✅ Ревью `claude-opus-5-5` без Critical/Important; итог принят владельцем

## Не делать

- ❌ Не откатывать production без подтверждения владельца в чате
- ❌ Не восстанавливать БД из бэкапа на production
