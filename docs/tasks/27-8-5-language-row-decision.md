---
id: '27.8.5'
phase: '27'
epic: '27.8'
status: done
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (UI-05). Закрыта 2026-11-10: решение AQ-12 — «Русский» без выбора, внесено в 21.4.8.'
ref_id: ''
review_ref: 'UI-05'
priority: P3
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: owner
roles: [PRODUCT]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '0.5-1'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, product, ui]
---

# Task 27.8.5: Строка «Язык» в профиле игрока: решение до реализации 21.4.8

## Цель

В профиле не появится переключатель языка без переводов.

## Контекст

- Замечание `UI-05` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- [21.4.8](21-4-8-player-screens-tails.md) включает строку «Язык» из макета; переводов в плане нет. П. 2 карточки 21.4.8 уже предписывает показывать текущий язык без перехода — вариант «без выбора» почти покрыт.
- 21.4.8 входит в `v0.3.1` и получает `AQ-12` в `decisions`: решение нужно до её старта.
- Модель: реализация `claude-haiku-5-5`, ревью `claude-sonnet-5-5` (итог принимает владелец); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. По AQ-12 обновить 21.4.8: убрать строку или показывать «Русский» без выбора.
2. Запись решения в журнал.

## Критерии приёмки

- ✅ 21.4.8 обновлена до старта её реализации
- ✅ Ревью `claude-sonnet-5-5` без Critical/Important; итог принят владельцем

## Не делать

- ❌ Не реализовывать i18n
