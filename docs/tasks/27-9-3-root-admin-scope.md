---
id: '27.9.3'
phase: '27'
epic: '27.9'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (PROD-03). Релиз назначает владелец; не стартует до решения AQ-10.'
ref_id: ''
review_ref: 'PROD-03'
priority: P2
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: owner
roles: [PRODUCT]
depends_on: ['27.9.1']
supersedes: []
decisions: ['AQ-10']
estimated_hours: '2-3'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, product, root-admin]
---

# Task 27.9.3: Минимальный объём Root Admin для беты

## Цель

v0.4.0 содержит только то, что нужно для 2–5 организаторов беты.

## Контекст

- Замечание `PROD-03` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Фаза [22](../phases/22-root-admin.md): 9 задач (обзор, организации, пользователи, баланс и тарифы, выдача, журнал, настройки, подписки и выплаты).
- Для 2–5 организаторов может хватить операторских команд с журналом.
- Открытые решения владельца: AQ-10 ([фаза 27, «Открытые вопросы»](../phases/27-audit-hardening.md#открытые-вопросы-владельца)). Карточка с открытым решением не стартует.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (итог принимает владелец); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Для каждой карточки фазы 22: нужна ли она в бете, чем заменяется (команда, SQL по runbook) — таблица для AQ-10.
2. По решению: обновить `release` и `status_note` карточек фазы 22 и RELEASES.

## Критерии приёмки

- ✅ Объём v0.4.0 утверждён, карточки и RELEASES обновлены
- ✅ Ревью `claude-opus-5-5` без Critical/Important; итог принят владельцем

## Не делать

- ❌ Не удалять карточки фазы 22
