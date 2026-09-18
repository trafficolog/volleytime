---
id: "4.2.1"
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
  - "4.1.2"
estimated_hours: "2"
tags:
  - notifications
  - scheduler
---

# Task 4.2.1: Напоминание за 24 часа

## Цель

Реализовать функцию `send_24h_reminder(training_id)`, которая рассылает напоминание всем подтверждённым участникам за 24 ч до начала. Идемпотентно: повторный вызов в тот же день не приведёт к повторной отправке.

## Контекст

Stub функции уже есть из 4.1.2. Здесь — реальная логика.

UX-задача: формулировка должна быть тёплой, информативной, без капса. Время и место — обязательны, цена и статус — по ситуации.

## Что должно быть сделано

- В `src/scheduler/jobs.py` доработать `send_24h_reminder(training_id)`:
  1. Открыть сессию БД (`async_session_maker()`)
  2. Загрузить Training с тренировкой
  3. Если статус `cancelled` или `finished` — выйти (тренировка уже не актуальна)
  4. Загрузить все Booking со статусом `confirmed` или `pending_payment` (waitlist — отдельный текст)
  5. Для каждого:
     - Если `reminder_24h_sent_at` уже стоит — пропустить (идемпотентность)
     - Сформировать текст:
       ```
       🏐 Завтра тренировка!

       📅 {format_dt_human(starts_at)}
       📍 {venue}

       Ваш статус: {slot_type_label}
       {payment_status_note}

       Если планы изменились — отмените в боте: /start
       ```
     - Для waitlist: «вы в листе ожидания #N. Если место освободится, я уведомлю отдельно.»
     - Для pending_payment: «не забудьте оплату — N BYN наличными.»
     - Отправить через `Notifier.send(user.telegram_id, text)`
     - При успехе — `booking.reminder_24h_sent_at = now()`
  6. `commit()`
- В `src/db/models.py` добавить поле:
  - `Booking.reminder_24h_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)`
  - `Booking.reminder_2h_sent_at` — аналогично
- В Phase 6 (Alembic) будет миграция, пока в Phase 4 — `Base.metadata.create_all` подхватит автоматически.
- Notifier: для job нужен `Notifier` без middleware (job вне http/bot lifecycle). Решение: создать в job-функции через `Bot(token=...)`, использовать локально, или поднять глобальный singleton.

## Критерии приёмки

- Тест (4.4.1): job вызвана для confirmed-игроков → каждый получил сообщение, `reminder_24h_sent_at` записан
- Тест: повторный вызов того же job → no-op
- Тест: тренировка с `status=cancelled` → никто не получает уведомления
- Тест: если у игрока бот заблокирован (TelegramForbiddenError) — другие всё равно получают, ошибка логируется

## Подсказки

- `Notifier` в job: проще всего глобально через `src/scheduler/scheduler.py` хранить ссылку на bot, в job — `notifier = Notifier(bot)`.
- Текст лучше выносить в `src/bot/texts.py` (новый модуль) — там же будут шаблоны для 2h, waitlist promotion, и т.п.
- `TelegramForbiddenError` от aiogram — для случая, когда пользователь заблокировал бот. Это нормально, не сбой.

## Не делать

- Не отправлять напоминания тем, кто `cancelled` или `attended` — это бессмысленно.
- Не делать кастомные тексты на каждого игрока (это спам-трюки).
- Не подгружать всю историю — только booking для конкретной тренировки.
