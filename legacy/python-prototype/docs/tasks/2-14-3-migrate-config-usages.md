---
id: "2.14.3"
phase: "2.5"
epic: "2.14"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BACK
depends_on:
  - "2.14.1"
estimated_hours: "2"
tags:
  - admin
  - settings
  - refactor
---

# Task 2.14.3: Перевести услуг на SettingsService

## Цель

Найти все места в коде, где захардкожены значения настроек (типа `BOOKING_CLOSES_HOURS_BEFORE = 2`) или прямые обращения к `settings.X` (если X — в нашем новом списке), и заменить на `await settings_service.get("key")`.

## Контекст

Без этой задачи Task 2.14.1+2.14.2 будут декоративными — настройки в БД меняются, но код продолжает использовать старые значения.

## Что должно быть сделано

- Список мест для замены (предварительный, надо пройтись по коду):
  - `src/services/booking.py`:
    - `BOOKING_CLOSES_HOURS_BEFORE` → `settings_service.get("booking_closes_hours_before")`
  - `src/services/subscription.py`:
    - Используется ли `settings.X`? Если да — мигрировать.
  - `src/bot/handlers/admin/trainings.py` (FSM создания тренировки):
    - В `Training.price_main = settings.base_training_price` (если есть) → из settings_service
    - `max_main_slots`, `max_rotation_slots` — defaults из settings_service
  - При создании Training (Task 2.9.3 — серия) — дефолтные лимиты из settings_service
  - `src/scheduler/jobs.py` (Phase 4):
    - `pending_payment_ttl_minutes` — из settings
    - `waitlist_promotion_ttl_minutes` — из settings
    - `reminder_24h_enabled`, `reminder_2h_enabled` — из settings (если false, job просто завершается)
  - `src/config.py`:
    - Оставить старые поля как **fallback** (для случая когда БД ещё не инициализирована), но пометить deprecated
    - Или удалить — на усмотрение
- Особое внимание к сервисам, которые получают сессию через DI — там SettingsService подключается легко
- Где сессии нет (например, в `keyboards.py` или в скрипте) — либо передать settings_service, либо использовать sync wrapper / cached value

## Критерии приёмки

- Изменение `base_training_price` через UI (Task 2.14.2) → следующая созданная тренировка имеет новую цену
- Изменение `booking_closes_hours_before` с 2 на 4 → попытка записаться за 3 часа отклоняется
- Изменение `reminder_24h_enabled = false` → 24h-напоминания не отправляются
- Все тесты Phase 1+2 проходят (адаптировать при необходимости)

## Подсказки

- В тестах добавить фикстуру `mock_settings(monkeypatch)`, которая заполняет cache настроек тестовыми значениями без БД.
- DI через middleware: `SettingsMiddleware` по аналогии с NotifierMiddleware.

## Не делать

- Не убирать `src/config.py` совсем — там остаются секреты и инфраструктура.
- Не делать «hot reload» в Phase 2.5 — изменение настройки применяется со следующего запроса, не на лету для существующих jobs.
- Не пересчитывать существующие тренировки/брони/абонементы при изменении настроек — только новые.
