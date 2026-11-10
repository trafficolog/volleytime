---
id: '27.8.4'
phase: '27'
epic: '27.8'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (UI-04, PROD-17). Релиз назначает владелец.'
ref_id: ''
review_ref: 'UI-04, PROD-17'
priority: P2
complexity: S
impl_model: claude-haiku-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [QA]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '1-2'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, qa, docs]
---

# Task 27.8.4: Матрица устройств в релизной QA: Android, iOS, Desktop, Telegram Web

## Цель

Каждый релиз фиксирует, на каких клиентах Telegram проверены Mini App и бот.

## Контекст

- Замечание `UI-04`, `PROD-17` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** DoD релизов v3 требует Android и Desktop; iOS и Telegram Web не упоминаются; у v0.2.0 нет отчёта о проверках на устройствах ([RELEASES](../RELEASES.md)).
- Только документы: шаблон и правка DoD.
- Модель: реализация `claude-haiku-5-5`, ревью `claude-sonnet-5-5` (стандартное ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Шаблон `docs/operations/qa/templates/device-matrix.md`: клиенты × сценарии (вход, запись, отмена, оплата, уведомление, организатор).
2. В общем DoD релизов v3 ([RELEASES](../RELEASES.md)) ссылка на шаблон; iOS и Telegram Web — по возможности, отсутствие отмечается явно.

## Критерии приёмки

- ✅ Шаблон есть, DoD ссылается на него
- ✅ Ревью `claude-sonnet-5-5` без Critical/Important

## Не делать

- ❌ Не менять код
