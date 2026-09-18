---
date: 2026-05-24
iteration_number: 001
task_ids:
  - "1.1.1"
  - "1.1.2"
  - "1.1.3"
  - "1.1.4"
  - "1.2.1"
  - "1.2.2"
  - "1.2.3"
  - "1.3.1"
  - "1.3.2"
  - "1.3.3"
  - "1.3.4"
  - "1.4.1"
  - "1.4.2"
  - "1.5.1"
  - "1.5.2"
commit_sha: "<TBD: initial commit>"
files_changed: 30
tests_passing: 5
tests_total: 5
---

# Iteration 001: Phase 1 MVP — initial scaffold

## Что сделано

Собран весь скелет проекта в одном коммите:

- Инфраструктура (requirements, конфиг, утилиты)
- Модели и async-engine SQLAlchemy
- Базовый бот: middleware, хендлеры, FSM создания тренировки
- BookingService с распределением слотов и листом ожидания
- Заглушка bePaid webhook с проверкой RSA-подписи
- 5 юнит-тестов на BookingService

## Затронутые файлы

- `src/config.py`
- `src/db/{base,models,repositories}/...`
- `src/services/booking.py`
- `src/bot/{main,middlewares,keyboards,handlers/...}.py`
- `src/web/bepaid_webhook.py`
- `src/utils/{money,time}.py`
- `tests/test_booking_service.py`
- `requirements.txt`, `.env.example`, `.gitignore`, `pytest.ini`, `README.md`

## Тесты

- До: 0
- После: 5 passing
- Новые тесты:
  - `test_first_player_gets_main_slot`
  - `test_slots_fill_in_order_main_rotation_waitlist`
  - `test_cannot_book_twice`
  - `test_booking_closed_within_window`
  - `test_cancel_promotes_waitlist`

## Следующая итерация

- 002: Phase 2 — субсервисы и UX покупки/оплаты
