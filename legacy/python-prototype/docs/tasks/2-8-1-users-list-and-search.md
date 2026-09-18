---
id: "2.8.1"
phase: "2.5"
epic: "2.8"
status: todo
sync_state: drifted
last_reviewed: 2026-05-25
status_note: ""
roles:
  - BOT
  - BACK
depends_on: []
estimated_hours: "2-3"
tags:
  - admin
  - users
---

# Task 2.8.1: Список игроков и поиск

## Цель

В admin_menu появляется кнопка «👥 Игроки». При нажатии — список зарегистрированных пользователей с пагинацией, фильтром по статусу и поиском по имени/username/Telegram ID.

## Контекст

База для всего Epic 2.8 (карточка, редактирование, блокировка). Без списка админ не сможет добраться до конкретного пользователя.

В БД уже есть таблица `User` с полями `telegram_id`, `username`, `full_name`, `phone`, `role`, `is_active`, `created_at` (Phase 1).

## Что должно быть сделано

- В `src/bot/keyboards.py` добавить в `admin_menu()` кнопку «👥 Игроки» → `callback_data="admin:users:list"`
- Новый файл `src/bot/handlers/admin/users.py`, router зарегистрирован в `admin/__init__.py`
- Хендлер `admin:users:list` (опционально с параметрами page, filter, query):
  - Запрос: `SELECT * FROM users ORDER BY created_at DESC LIMIT 10 OFFSET <page*10>`
  - Применяется фильтр `is_active = true/false`, `role = admin`
  - Если есть `query` (от поиска) — `WHERE full_name ILIKE %query% OR username ILIKE %query% OR telegram_id::text = query`
- Внешний вид:
  ```
  👥 Игроки (всего 47, активных 42)

  Фильтр: [все] [активные] [заблокированные] [админы]
  Поиск: 🔍 [нажать чтобы ввести]

  • 👤 Пётр Петров @petrov · main 12 · attended 8
  • 👤 Маша Иванова · main 6 · attended 5
  • 👑 Анна Админ @anna · admin
  ...

  ◀️ 1 / 5 ▶️
  ```
- Кнопки: каждая строка — отдельная inline-кнопка с callback_data `admin:user:view:<user_id>`
- Кнопка «🔍 Поиск» открывает FSM `SearchUser.waiting_query`, в которой пользователь вводит строку → переход обратно в список с применённым фильтром
- Хелпер `UserRepository.search_users(query: str | None, filter: str | None, page: int, page_size: int = 10) -> tuple[list[User], int]` (возвращает страницу + total count)

## Критерии приёмки

- В админ-меню видна кнопка «👥 Игроки»
- При нажатии открывается первая страница списка
- Пагинация: переход на следующую страницу не теряет фильтр и query
- Поиск по части имени работает (case-insensitive)
- Поиск по `@username` без `@` работает
- Поиск по Telegram ID работает
- Фильтр «заблокированные» показывает только `is_active=false`

## Подсказки

- Иконки: 👤 — обычный игрок, 👑 — админ, 🚫 — заблокирован.
- Для SQLite `ILIKE` нет — использовать `func.lower(...)  LIKE func.lower(...)`.
- Можно вместо FSM поиска использовать вариант «нажми кнопку → пиши следующим сообщением» (это тот же FSM, просто описание понятнее).
- Состояние пагинации/фильтра можно держать в callback_data: `admin:users:list:p=2:f=active:q=петр`. Длина callback ограничена 64 байтами, при превышении — fallback на FSM-state.

## Не делать

- Не показывать в публичном списке полный `phone` — только в карточке (Task 2.8.2).
- Не делать «массовая блокировка» / «массовый экспорт» — это Phase 5.
- Не подгружать связанные сущности (bookings, subscriptions) — в списке только агрегаты, детали в карточке.
