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
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '1-3'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, ops, scheduler, concurrency]
---

# Task 27.5.5: Планировщик: проверочный тест двух экземпляров

## Цель

Две копии web (при выкладке или ошибке) не выполняют одни и те же задачи планировщика дважды.

## Контекст

- Замечание `OPS-04` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Планировщик работает в процессе web (`SCHEDULER_ENABLED`, интервал 15 с): открытие и закрытие записи, финализация split, напоминания.
- **Как есть:** `apps/web/server/plugins/scheduler.ts` заявляет, что несколько экземпляров безопасны: задачи берутся `SKIP LOCKED`, переходы — под `pg_advisory_xact_lock`. Карточка закрепляет это тестом, а не строит защиту заново.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Сверить заявление в `scheduler.ts` с кодом каждой задачи; задачи без блокировки перечислить в PR.
2. Интеграционный тест: два параллельных тика → каждая задача выполнена один раз (особенно финализация split и напоминания).
3. Если найдена задача без защиты — остановиться и вернуть карточку оркестратору для переоценки.

## Критерии приёмки

- ✅ Параллельные тики не дублируют действия (тест, в том числе финализация split)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не вводить внешнюю очередь
