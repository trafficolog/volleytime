---
id: "4.2.2"
phase: 4
epic: "4.2"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
  - PRODUCT
depends_on:
  - "4.2.1"
estimated_hours: "1-2"
tags:
  - notifications
  - scheduler
---

# Task 4.2.2: Напоминание за 2 часа + закрытие записи

## Цель

Реализовать `send_2h_reminder_and_close(training_id)`: рассылает финальное напоминание и переводит `Training.status` в `closed` (новая запись на тренировку невозможна).

## Контекст

В Phase 1 `BookingService` уже отказывается принять запись, если до начала меньше `BOOKING_CLOSES_HOURS_BEFORE` часов. Эта задача делает переход явным — статус Training становится `closed`, что также проверяется в `propose_slot`.

## Что должно быть сделано

- В `src/scheduler/jobs.py` доработать `send_2h_reminder_and_close(training_id)`:
  1. Загрузить Training
  2. Если `cancelled` или `finished` — выйти
  3. Перевести `Training.status = closed` (если ещё `open`/`planned`)
  4. Загрузить confirmed bookings (без waitlist!)
  5. Отправить каждому короткое напоминание:
     ```
     ⏰ Через 2 часа тренировка

     📍 {venue}, {time}
     До встречи!
     ```
  6. Записать `booking.reminder_2h_sent_at = now()` (идемпотентно)
  7. Отдельное уведомление админу:
     ```
     🔒 Запись на тренировку {format_dt} закрыта.
     Состав: {N} основных, {M} ротация. Лист ожидания: {K}.
     ```

## Критерии приёмки

- Тест: после job `Training.status == closed`
- Тест: после job попытка `BookingService.propose_slot` для этой тренировки → `TrainingClosedError`
- Тест: все confirmed-игроки получили сообщение
- Тест: админ получил саммари

## Подсказки

- Уведомление админу — через `Notifier.send_to_admins(settings.admin_telegram_ids, ...)`.
- Подсчёт состава — можно через `TrainingRepository.count_active_bookings`.

## Не делать

- Не отправлять напоминание waitlist (им уже отправили в 24h).
- Не возвращать `Training.status` обратно в `open` ни при каких обстоятельствах.
- Не создавать ещё одну job на закрытие записи — оно входит в эту.
