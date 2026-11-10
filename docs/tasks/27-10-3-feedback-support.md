---
id: '27.10.3'
phase: '27'
epic: '27.10'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (PROD-10). Релиз назначает владелец; не стартует до решения AQ-16.'
ref_id: ''
review_ref: 'PROD-10'
priority: P1
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [BACK, FE]
depends_on: []
supersedes: ['10.2.1', '10.2.2']
decisions: ['AQ-16']
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, product, feedback]
---

# Task 27.10.3: Обратная связь из Mini App и кабинета владельцу платформы

## Цель

Любой пользователь отправляет сообщение о проблеме с контекстом экрана, владелец получает его в Telegram.

## Контекст

- Замечание `PROD-10` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- [10.2.1](10-2-1-feedback-endpoint.md) и [10.2.2](10-2-2-feedback-ui.md) (todo) описывают то же; предлагается поглотить их (AQ-16), `superseded_by` у 10.2.x ставится после решения.
- Сообщение — пользовательский текст: экранирование ([27.4.5](27-4-5-bot-html-escaping.md)) и лимит частоты ([27.4.1](27-4-1-rate-limits.md)).
- Открытые решения владельца: AQ-16 ([фаза 27, «Открытые вопросы»](../phases/27-audit-hardening.md#открытые-вопросы-владельца)). Карточка с открытым решением не стартует.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (пользовательский ввод уходит в бота); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Эндпоинт: текст до 2000 символов, маршрут экрана, версия релиза, id пользователя и группы; лимит частоты.
2. Пункт «Сообщить о проблеме» в профиле Mini App и меню кабинета.
3. Доставка владельцу через бота; тесты эндпоинта и экранирования.

## Критерии приёмки

- ✅ Сообщение доходит владельцу с контекстом (тест с подменой бота)
- ✅ Лимит частоты работает
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не строить тикет-систему
