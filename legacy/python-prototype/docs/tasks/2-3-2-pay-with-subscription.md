---
id: "2.3.2"
phase: 2
epic: "2.3"
status: done
sync_state: aligned
last_reviewed: 2026-05-24
status_note: ""
roles:
  - BOT
  - BACK
depends_on:
  - 2.1.3
  - 2.3.1
estimated_hours: "2"
tags:
  - booking
  - subscriptions
---

# Task 2.3.2: Оплата с абонемента (confirmed сразу)

## Цель

Реализовать оплату записи с помощью абонемента: бронь сразу `confirmed`, сессия списана.

## Контекст

Самый частый сценарий после Фазы 2: у игрока есть абонемент, он жмёт кнопку с напоминанием остатка.

## Что должно быть сделано

- Хендлер `booking:pay:sub:<id>`
- Получение активного абонемента через `SubscriptionService.get_best_for_consumption`
- Атомарное списание сессии
- Создание `Booking` в статусе `confirmed`
- При ошибке `NoSlotsError` — восстановление сессии (`restore_session`)

## Критерии приёмки

- После записи Booking.status == confirmed
- Subscription.used_sessions увеличен на 1
- При гонке (нет места) сессия возвращена
- Пользователь видит сообщение «осталось X из Y»

## Не делать

- Не списывать сессию ДО проверки наличия слота
- Не забыть восстановить сессию при ошибке
