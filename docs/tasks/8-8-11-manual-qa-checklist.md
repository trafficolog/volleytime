---
id: '8.8.11'
phase: '8'
epic: '8.8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: чеклист готов; реальный Telegram QA не выполнялся, поскольку staging/production bot ещё не развёрнут.'
review_ref: 'Phase 8 · P2 #11'
priority: P2
roles:
  - QA
  - DOCS
depends_on:
  - '8.8.3'
  - '8.8.7'
estimated_hours: '1'
tags:
  - qa
  - telegram
  - review-fix
---

# Task 8.8.11: Чеклист ручного QA в реальном Telegram (iOS/Android/Desktop)

## Цель

Сценарии, которые нельзя автоматизировать, проверяются по чеклисту перед релизом.

## Контекст

QA в реальном Telegram не проводился.

## Что должно быть сделано

1. `docs/operations/qa/telegram-miniapp-checklist.md`: вход, deeplink `org_`/`event_`, запись/отмена, тема light/dark, BackButton/MainButton, уведомления с кнопкой, оплата → уведомление организатору.
2. Таблица результатов по платформам; статус карточки — `in_progress` до прогона.

## Критерии приёмки

- ✅ Чеклист в репозитории, ссылка из release checklist

## Подсказки

-

## Не делать

-
