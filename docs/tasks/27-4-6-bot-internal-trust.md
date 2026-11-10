---
id: '27.4.6'
phase: '27'
epic: '27.4'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (BOT-02). Релиз назначает владелец.'
ref_id: ''
review_ref: 'BOT-02'
priority: P2
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK]
depends_on: ['27.1.1']
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, bot, access]
---

# Task 27.4.6: Проверки на стороне web для внутренних действий бота

## Цель

Внутренние маршруты бота проверяют права пользователя так же, как пользовательские API, а не доверяют боту.

## Контекст

- Замечание `BOT-02` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- `apps/web/server/api/internal/bot/*` принимают `telegramUserId` от бота как истину.
- После [27.1.1](27-1-1-internal-api-closed.md) маршруты недоступны снаружи; карточка проверяет второй рубеж.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Для каждого маршрута: какие права проверяются (членство, статус, роль) — таблица в PR.
2. Довести до паритета с пользовательскими API (те же функции core).
3. Тесты: заблокированный, вышедший, pending, чужая группа → отказ.

## Критерии приёмки

- ✅ Паритет проверок с пользовательскими API (тесты по таблице)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять контракт бот↔web
