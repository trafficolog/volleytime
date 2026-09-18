---
id: "2.3.3"
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
  - 2.3.1
estimated_hours: "2"
tags:
  - booking
  - manual-payment
---

# Task 2.3.3: Оплата наличными (pending + уведомление)

## Цель

Реализовать оплату записи наличными: бронь pending, уведомление админу, подтверждение кнопкой.

## Контекст

Используется до Фазы 3 (bePaid). Должен быть «человеческий» цикл с минимальным трением.

## Что должно быть сделано

- Хендлер `booking:pay:cash:<id>`
- Создание `Booking` в `pending_payment`
- Создание `Payment` (kind=single, method=cash, status=pending)
- Уведомление всем админам с deeplink на /admin меню
- Сообщение игроку «принесите N BYN на тренировку»

## Критерии приёмки

- Booking.status == pending_payment
- Payment.status == pending
- Админ получает уведомление в личку
- После подтверждения админом (см. 2.6.2) — Booking.status == confirmed

## Не делать

- Не подтверждать платёж автоматически
- Не подменять PaymentService.confirm — это работа админа
