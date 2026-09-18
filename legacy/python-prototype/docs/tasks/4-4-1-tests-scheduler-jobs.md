---
id: "4.4.1"
phase: 4
epic: "4.4"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - QA
depends_on:
  - "4.2.1"
  - "4.2.2"
  - "4.3.1"
  - "4.3.2"
  - "4.3.3"
estimated_hours: "3-4"
tags:
  - tests
  - scheduler
  - freezegun
---

# Task 4.4.1: freezegun + тесты scheduler-задач

## Цель

Покрыть тестами все 6 job-функций Phase 4. Используем `freezegun` для имитации времени, вызываем функции напрямую (без планировщика), проверяем побочные эффекты через mock Notifier.

## Контекст

Тесты scheduler-задач — самая сложная часть тестирования. Решение:
- НЕ запускаем APScheduler в тестах (он завязан на реальное время и реальный jobstore).
- Тестируем САМИ функции-задачи (`send_24h_reminder`, `expire_pending_booking`, etc.) — они принимают аргументы и работают с БД и Notifier.
- Время фрезим через `freezegun` где нужно.

## Что должно быть сделано

- В `requirements.txt` добавить `freezegun==1.5.1` в dev-зависимости
- В `tests/conftest.py` хелпер `mock_notifier()`:
  - Возвращает stub-объект с `sent: list[tuple[int, str]]`
  - Метод `send(telegram_id, text)` — добавляет в list, возвращает True
- В `tests/test_scheduler_jobs.py`:
  - **test_send_24h_reminder_for_confirmed_only**:
    - Создать тренировку через 24 ч, 3 confirmed bookings, 1 cancelled
    - Вызвать `send_24h_reminder(training_id)`
    - Notifier.sent имеет 3 записи (не 4), все brookings имеют `reminder_24h_sent_at`
  - **test_24h_reminder_idempotent**:
    - Вызвать дважды → Notifier.sent имеет 3 записи (не 6)
  - **test_2h_reminder_closes_registration**:
    - Тренировка `status=open`
    - Вызвать `send_2h_reminder_and_close`
    - `status == closed`
  - **test_expire_pending_booking_after_ttl**:
    - Booking создан в pending_payment 5 мин назад
    - `freeze_time(now + 16 min)` → вызвать `expire_pending_booking(booking_id)`
    - `Booking.status == cancelled`, причина `pending_payment_expired`
  - **test_expire_skips_if_already_confirmed**:
    - Booking перешёл в confirmed (webhook успел) → вызвать job → no-op
  - **test_waitlist_promotion_with_ttl**:
    - main/rotation заполнены, 2 в waitlist
    - Отмена → первый в waitlist получает уведомление, его статус `pending_confirmation`
    - Через 30 мин (freezegun) → job → первый возвращается в waitlist, второй получает уведомление
  - **test_auto_finish_training**:
    - Тренировка с ends_at = 1 час назад, status=closed
    - Вызвать `auto_finish_training` → status=finished

## Критерии приёмки

- 7+ тестов проходят
- `freezegun` корректно работает с `datetime.now(tz=...)` — некоторые версии freezegun имеют ограничения с tz, проверить
- Все тесты на in-memory SQLite, < 5 сек суммарно

## Подсказки

- freezegun: `@freeze_time("2026-05-25 10:00:00")` или `with freeze_time(...)`.
- Если freezegun плохо работает с aware datetime — альтернатива: передавать `now_func` как параметр в jobs (DI clock).
- `Notifier` подменяется через monkey-patch: `monkeypatch.setattr(jobs, "_get_notifier", lambda: mock_notifier)`.

## Не делать

- Не запускать настоящий APScheduler в тестах — медленно и flaky.
- Не использовать `asyncio.sleep` для имитации задержек.
- Не покрывать реальный Telegram API — используем mock Notifier.
