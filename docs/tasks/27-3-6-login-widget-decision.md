---
id: '27.3.6'
phase: '27'
epic: '27.3'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (AUTH-06). Релиз назначает владелец; не стартует до решения AQ-8.'
ref_id: ''
review_ref: 'AUTH-06'
priority: P3
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: owner
roles: [BACK, FE]
depends_on: []
supersedes: []
decisions: ['AQ-8']
estimated_hours: '1-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, auth, telegram, cleanup]
---

# Task 27.3.6: Login Widget: включить с проверкой или удалить

## Цель

Код входа через Telegram Login Widget не лежит выключенным без срока: он либо включён и проверен, либо удалён.

## Контекст

- Замечание `AUTH-06` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `TELEGRAM_LOGIN_WIDGET_ENABLED` выключен с v0.2.0; эндпоинт отвечает 404 (`packages/auth/src/telegram/plugin.ts`); виджету нужен домен в BotFather.
- Открытые решения владельца: AQ-8 ([фаза 27, «Открытые вопросы»](../phases/27-audit-hardening.md#открытые-вопросы-владельца)). Карточка с открытым решением не стартует.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (итог принимает владелец); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Подготовить для AQ-8: что даёт виджет (вход в кабинет без email), что нужно (домен в BotFather, проверка на устройствах).
2. Включить: чеклист включения флага отдельным релизным коммитом с подтверждением владельца. Удалить: убрать эндпоинт, флаг, клиентский код и тесты.

## Критерии приёмки

- ✅ Решение AQ-8 исполнено; при удалении поиск по флагу находит только историю
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important; итог принят владельцем

## Не делать

- ❌ Не включать флаг в production без подтверждения владельца
