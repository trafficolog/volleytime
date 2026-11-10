---
id: '27.10.5'
phase: '27'
epic: '27.10'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (PROD-13). Релиз назначает владелец; не стартует до решения AQ-18.'
ref_id: ''
review_ref: 'PROD-13'
priority: P2
complexity: L
impl_model: claude-opus-5-5
review_model: claude-opus-5-5
review_gate: opus+tests
roles: [BACK, FE, PRODUCT]
depends_on: ['27.3.5']
supersedes: []
decisions: ['AQ-18']
estimated_hours: '4-8'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, product, auth, access]
---

# Task 27.10.5: Восстановление доступа владельца группы

## Цель

Потеря Telegram-аккаунта владельцем не означает потерю группы.

## Контекст

- Замечание `PROD-13` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- Владелец, вошедший только через Telegram, без email не имеет второго способа входа.
- Передача владения существует; восстановления через платформу нет.
- Открытые решения владельца: AQ-18 ([фаза 27, «Открытые вопросы»](../phases/27-audit-hardening.md#открытые-вопросы-владельца)). Карточка с открытым решением не стартует.
- Модель: реализация `claude-opus-5-5`, ревью `claude-opus-5-5` (безопасность, доступ или деньги; обязательны тесты граничных случаев); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Предложение привязать email владельцу (баннер в кабинете и Mini App, пока email не привязан).
2. Процедура по AQ-18 для root: проверка личности, передача владения другому участнику, журнал — runbook и операторская команда.
3. Тесты команды: журнал, отзыв сессий прежнего аккаунта.

## Критерии приёмки

- ✅ Баннер показывается владельцу без email
- ✅ Процедура описана и покрыта тестами команды
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не делать самообслуживаемое восстановление без проверки личности
