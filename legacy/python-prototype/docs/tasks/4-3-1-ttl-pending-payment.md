---
id: "4.3.1"
phase: 4
epic: "4.3"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
depends_on:
  - "4.1.1"
estimated_hours: "2"
tags:
  - scheduler
  - booking
  - ttl
---

# Task 4.3.1: TTL pending_payment (15 минут → cancel)

## Цель

Когда создаётся Booking в `pending_payment` (cash или unpaid bePaid), регистрируется одноразовая задача `expire_pending_booking(booking_id)`. Через 15 минут, если статус всё ещё `pending_payment` — отменить, освободить слот, продвинуть waitlist.

## Контекст

Без этого: пользователь нажал «Записаться», получил инвойс, передумал, ушёл. Слот заблокирован до отмены вручную.

15 минут — компромисс между «успеть оплатить» и «не блокировать слот зря».

## Что должно быть сделано

- В `src/scheduler/jobs.py`:
  - `async def expire_pending_booking(booking_id: int) -> None`:
    1. Загрузить Booking
    2. Если статус не `pending_payment` — выйти (уже подтверждён, отменён, или истёк)
    3. Загрузить связанный Payment
    4. Если Payment.status == succeeded — это race condition: webhook пришёл, но статус Booking ещё не обновился. Выйти.
    5. Иначе:
       - `Payment.status = failed`, причина `expired_ttl`
       - `Booking.status = cancelled`, `cancellation_reason = "pending_payment_expired"`
       - Если был subscription_id — restore_session (хотя для pending он не должен быть, но на всякий)
       - `BookingService.promote_from_waitlist(training_id)`
       - Notify пользователя: «бронь отменена — оплата не пришла за 15 мин»
- В хендлерах, создающих pending Booking (`booking:pay:cash:*`, `booking:pay:bepaid:*`):
  - После создания Payment — `scheduler.add_job(expire_pending_booking, 'date', run_date=now+15min, id=f"expire_booking_{booking.id}", args=[booking.id], replace_existing=True)`
- Конфиг `settings.pending_payment_ttl_minutes = 15` (но менять без необходимости не нужно)

## Критерии приёмки

- Тест (4.4.1):
  1. Создать Booking в pending_payment
  2. Передвинуть clock на 16 мин (freezegun)
  3. Вызвать `expire_pending_booking` напрямую
  4. Booking.status == cancelled
  5. Если был waitlist — первый продвинут
- Тест race condition: Booking в pending → webhook успел сделать confirmed → job вызвана → no-op
- Тест: если в waitlist кто-то есть, после expire он переходит в main/rotation

## Подсказки

- Можно сделать ещё надёжнее: вместо отдельного job на каждую бронь — один периодический job «каждые 5 минут проверяй pending-брони и истекай». Но: меньше точность по времени, нагрузка на БД. Для нашего масштаба job-per-booking ок.
- ID job уникален per Booking — если retry создания брони, replace_existing=True перезапишет.

## Не делать

- Не отменять Booking через cancel вручную — использовать существующий `BookingService.cancel_booking`.
- Не использовать TTL для confirmed Booking — это работа Task 4.3.3 (auto-finished).
