---
id: '8.8.7'
phase: '8'
epic: '8.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 8 · P1 #7'
priority: P1
roles:
  - FE
depends_on:
  - '8.8.1'
estimated_hours: '1-2'
tags:
  - telegram
  - ux
  - review-fix
---

# Task 8.8.7: BackButton на вложенных экранах, MainButton в ключевых сценариях

## Цель

Нативная навигация Telegram.

## Контекст

BackButton/MainButton не использовались (кроме нерабочего MainButton).

## Что должно быть сделано

1. `VtMiniHeader` с `back` → в Telegram показывает `BackButton` и скрывает свою кнопку.
2. MainButton: «Записаться» на событии, «Вступить» на приглашении — с прогрессом и cleanup.

## Критерии приёмки

- ✅ В Telegram системная «Назад» работает на вложенных экранах

## Подсказки

-

## Не делать

- ❌ Не оставлять обработчики после ухода со страницы
