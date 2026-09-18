---
id: "1.2.1"
phase: 1
epic: "1.2"
status: done
sync_state: aligned
last_reviewed: 2026-05-24
status_note: ""
roles:
  - DB
  - BACK
depends_on:
  - 1.1.3
estimated_hours: "3-4"
tags:
  - models
  - schema
---

# Task 1.2.1: Модели и enum-ы

## Цель

Описать SQLAlchemy 2.0 модели для всех сущностей домена.

## Контекст

База для всей системы. Изменения схемы потом будут идти через миграции, поэтому важно сразу заложить все нужные поля и связи.

## Что должно быть сделано

- Модели: User, Training, Booking, Subscription, Payment, LedgerEntry, AdminLog
- Enum-ы для статусов: UserRole, TrainingStatus, SlotType, BookingStatus, PaymentKind, PaymentMethod, PaymentStatus, SubscriptionStatus, LedgerType, LedgerCategory
- `Decimal(10, 2)` для денег, `DateTime(timezone=True)` для времени
- Уникальный индекс `(user_id, training_id)` на Booking
- Уникальный индекс на `Payment.bepaid_uid`

## Критерии приёмки

- `Base.metadata.create_all` создаёт 7 таблиц
- Невозможно создать две Booking на одного игрока в одну тренировку (IntegrityError)
- Все enum-ы соответствуют состояниям из DOMAIN.md

## Не делать

- Не использовать `float` для денег
- Не использовать `String` для дат
- Не описывать миграции (это Фаза 6)
