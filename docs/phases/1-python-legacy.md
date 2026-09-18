---
id: '1'
status: done
sync_state: archived
last_reviewed: 2026-05-25
status_note: 'Python-прототип legacy. Все 14 задач выполнены. Используется как референс.'
---

# Phase 1: Python MVP-каркас (legacy)

**Статус:** ✅ Архивирован в `legacy/python-prototype/`.

**Что было реализовано:**

- Telegram-бот на aiogram + SQLAlchemy + SQLite
- Базовые модели (User, Training, Booking, Subscription, Payment, LedgerEntry)
- Запись на тренировки с распределением слотов (main / rotation / waitlist)
- Команды бота (/start, /menu, регистрация)
- 5 эпиков, 14 задач, smoke-тесты

**Зачем сохранён:**

- Domain knowledge для нового стека
- Параллельная обкатка в реальной группе (UX-валидация)
- Эталон бизнес-логики для Phase 5-6 (Bookings + Payments)

Полная история — в `legacy/python-prototype/docs/`.
