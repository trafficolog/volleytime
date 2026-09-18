---
id: '8.8.6'
phase: '8'
epic: '8.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 8 · P1 #6'
priority: P1
roles:
  - BACK
depends_on:
  - '8.8.5'
estimated_hours: '1'
tags:
  - notifier
  - payments
  - review-fix
---

# Task 8.8.6: Организатор получает «новая оплата ждёт подтверждения»

## Цель

Организатор узнаёт о pending-оплате без захода в приложение.

## Контекст

Тип `payment_pending_organizer` отсутствовал.

## Что должно быть сделано

1. При создании pending-платежа (бронь, промоушен, абонемент) — уведомление owner/organizer организации (кроме самого плательщика).
2. Кнопка → `/m/orgs/:id/payments`.
3. Тест: collect содержит уведомление организаторам.

## Критерии приёмки

- ✅ Каждый pending-платёж → уведомление управляющим

## Подсказки

- Сбор в той же транзакции через collectNotification, отправка после коммита.

## Не делать

- ❌ Не уведомлять assistant/player
