---
id: '27.4.2'
phase: '27'
epic: '27.4'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (API-02). Релиз назначает владелец; не стартует до решения AQ-14.'
ref_id: ''
review_ref: 'API-02'
priority: P2
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [BACK]
depends_on: []
supersedes: []
decisions: ['AQ-14']
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, invites]
---

# Task 27.4.2: Единая длина токенов приглашений, срок и лимит по умолчанию

## Цель

Новые ссылки приглашений одинаково стойкие и по умолчанию ограничены сроком или числом использований.

## Контекст

- Замечание `API-02` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** приглашение в группу — `nanoid(16)` (`packages/core/src/invites/service.ts`), на событие — 24 символа (`event-invites.ts`), передача владения — 32 байта.
- Существующие ссылки должны продолжить работать.
- Открытые решения владельца: AQ-14 ([фаза 27, «Открытые вопросы»](../phases/27-audit-hardening.md#открытые-вопросы-владельца)). Карточка с открытым решением не стартует.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (по правилам ORCHESTRATION для этой области); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Новые приглашения в группу — `nanoid(24)`; длина в константе, как у приглашений на событие.
2. По AQ-14: срок и лимит использований по умолчанию при создании (организатор может изменить).
3. Тесты: длина новых токенов; старые 16-символьные принимаются; значения по умолчанию.

## Критерии приёмки

- ✅ Новые токены 24 символа, старые работают (тест)
- ✅ Значения по умолчанию по AQ-14
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не инвалидировать существующие приглашения
