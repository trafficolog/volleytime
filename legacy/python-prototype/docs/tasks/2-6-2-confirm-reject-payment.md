---
id: "2.6.2"
phase: 2
epic: "2.6"
status: done
sync_state: aligned
last_reviewed: 2026-05-24
status_note: ""
roles:
  - BOT
  - BACK
depends_on:
  - 2.6.1
  - 2.4.1
estimated_hours: "2-3"
tags:
  - admin
  - payments
---

# Task 2.6.2: Подтверждение/отклонение платежа

## Цель

Реализовать подтверждение и отклонение pending-платежа админом.

## Контекст

Ключевая операция Фазы 2. После подтверждения автоматически активируется абонемент или подтверждается бронь, поступление пишется в кассу.

## Что должно быть сделано

- Хендлер `admin:pay:confirm:<id>` → `PaymentService.confirm`
- Хендлер `admin:pay:reject:<id>` → `PaymentService.fail`
- Уведомление игроку об успехе/отказе
- Защита от двойного подтверждения (PaymentAlreadyProcessedError)
- Запись `confirmed_by_admin_id` для аудита

## Критерии приёмки

- Confirm → Subscription становится active, Booking — confirmed
- Confirm → LedgerEntry(income) создаётся
- Повторный confirm → внятная ошибка, без побочных эффектов
- Reject → Booking отменён, игрок уведомлён

## Не делать

- Не подтверждать через прямой UPDATE — только через PaymentService
- Не забыть про идемпотентность
