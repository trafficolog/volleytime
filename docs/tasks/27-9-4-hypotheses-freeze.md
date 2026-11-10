---
id: '27.9.4'
phase: '27'
epic: '27.9'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (PROD-04). Релиз назначает владелец.'
ref_id: ''
review_ref: 'PROD-04'
priority: P2
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: owner
roles: [PRODUCT]
depends_on: ['27.10.1']
supersedes: []
decisions: []
estimated_hours: '1-2'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, product, hypotheses]
---

# Task 27.9.4: Не детализировать гипотезы до появления метрик

## Цель

Карточки гипотез фаз 25–26 ждут данных метрик и не тратят время на детализацию заранее.

## Контекст

- Замечание `PROD-04` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Фазы [25](../phases/25-hypotheses-wave-1.md) и [26](../phases/26-hypotheses-wave-2.md): 11 задач за флагами; решение по каждой — по метрикам [23.1.2](23-1-2-feature-analytics.md), которые появятся в v0.5.0.
- Метрики раньше — [27.10.1](27-10-1-product-metrics.md).
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (итог принимает владелец); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Пометить карточки фаз 25–26 в `status_note`: «ждёт метрик 27.10.1, детализация после решения владельца».
2. Для каждой гипотезы — какая метрика её подтверждает (одна строка) в описании фазы.

## Критерии приёмки

- ✅ Карточки помечены, у каждой гипотезы указана метрика
- ✅ Ревью `claude-opus-5-5` без Critical/Important; итог принят владельцем

## Не делать

- ❌ Не удалять и не перенумеровывать карточки
