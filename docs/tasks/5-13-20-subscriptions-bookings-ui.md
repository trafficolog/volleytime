---
id: '5.13.20'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · Визуал «Абонементы / Мои записи»'
priority: P2
roles:
  - BACK
  - FE
depends_on:
  - '5.13.1'
  - '5.13.14'
estimated_hours: '2'
tags:
  - subscriptions
  - ui
  - review-fix
---

# Task 5.13.20: Абонементы: план, срок, pending-оплата, история; Мои записи: подтверждение и ошибки отмены

## Цель

Экраны абонементов и записей по дизайну PlayerSubs/PlayerBuy.

## Контекст

«Получить» → мгновенно «Активен»; нет плана, срока, истории; `window.confirm`; ошибка отмены после дедлайна не показывается.

## Что должно быть сделано

1. `subscriptions/my` отдаёт `plan: { name }`, историю списаний (брони с `subscription_id`).
2. Покупка: sheet «Оплата наличными / переводом», после — карточка «Ожидает подтверждения оплаты».
3. Мои записи: подтверждение отмены через `useConfirm` (Telegram `showConfirm` / fallback диалог), показ ошибки дедлайна.

## Критерии приёмки

- ✅ Pending-абонемент отображается как ожидающий оплаты
- ✅ Ошибка отмены после дедлайна видна

## Подсказки

- `useConfirm` добавить в `useTelegram`.

## Не делать

- ❌ Не использовать `window.confirm` в Mini App
