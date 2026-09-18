---
id: '8.9.1'
phase: '8'
epic: '8.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Ревью v0.1.1 · Phase 8 · P1'
priority: P1
roles:
  - BACK
depends_on: []
estimated_hours: '1'
tags:
  - notifier
  - review2-fix
---

# Task 8.9.1: Отдельный текст уведомления для брони, ожидающей оплаты

## Цель

«Место держим до подтверждения оплаты» вместо «Вы записаны».

## Контекст

`booking_confirmed` рендерился одинаково для `confirmed` и `pending_payment`; подсказка про оплату была только в `waitlist_promoted`.

## Что должно быть сделано

1. Тип уведомления `booking_pending_payment` (или ветка по `needsPayment` в шаблоне) с текстом: место забронировано, оплатите организатору, сумма и способ.
2. `bookingService.book` шлёт его при статусе `pending_payment`.
3. Тесты шаблона и сбора уведомлений.

## Критерии приёмки

- ✅ Запись наличными → уведомление про ожидание оплаты с суммой
- ✅ Запись с абонемента → прежнее «Вы записаны»

## Подсказки

- `waitlist_promoted` уже содержит нужную формулировку — переиспользовать тон.

## Не делать

-
