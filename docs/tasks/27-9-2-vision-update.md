---
id: '27.9.2'
phase: '27'
epic: '27.9'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (PROD-02, PROD-15). Релиз назначает владелец.'
ref_id: ''
review_ref: 'PROD-02, PROD-15'
priority: P2
complexity: M
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: owner
roles: [PRODUCT, TECHNICAL_WRITER]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, product, docs]
---

# Task 27.9.2: Привести PLATFORM_VISION к принятым решениям

## Цель

Видение не противоречит продукту: антицели, критический путь, бизнес-модель и открытые решения актуальны.

## Контекст

- Замечание `PROD-02`, `PROD-15` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Антицели `docs/PLATFORM_VISION.md`: «полноценный web admin кабинет до проверки гипотезы», «сложный split-payments», «BI-платформа»; фактически построены кабинет, split, отчёты и экспорт.
- Критический путь описывает фазы 7 и 10, заменённые референсом v3 (решение 2026-10-12); «repo приватный до Phase 10» — см. [27.2.3](27-2-3-repo-history-scan.md).
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (итог принимает владелец); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Таблица расхождений «видение ↔ решение или факт» со ссылками на журнал решений.
2. Правка документа по каждой строке с подтверждением владельца (оставить ограничение или снять).

## Критерии приёмки

- ✅ Нет противоречий видения с журналом решений
- ✅ Правки утверждены владельцем
- ✅ Ревью `claude-opus-5-5` без Critical/Important; итог принят владельцем

## Не делать

- ❌ Не менять журнал решений задним числом
