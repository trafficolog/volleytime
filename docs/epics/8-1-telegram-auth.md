---
id: '8.1'
phase: '8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Mini App auth через initData. Foundation.'
estimated_hours: '5-7'
depends_on: ['3.3', '3.4']
---

# Epic 8.1: Telegram WebApp auth (initData, User, session)

**Цель.** Аутентификация в Mini App: валидация Telegram initData на сервере, авто-создание/связывание User, выдача сессии better-auth. Fallback на email-логин в браузере.

## Контекст

Phase 3 заложил Telegram identity HMAC (3.3.3) и Mini App entrypoint (3.4.3). Теперь — рабочий auth flow: Telegram передаёт подписанный initData, сервер валидирует подпись (HMAC-SHA256 с bot token), извлекает пользователя, создаёт/находит User, выдаёт сессию.

Решение 3: initData основной + email fallback. Решение 4: авто-создание User из Telegram-данных без формы.

## Definition of Done

- Server endpoint валидирует initData (HMAC подпись по алгоритму Telegram)
- Валидный initData → User создаётся (если новый) или находится (по telegram_id)
- Сессия better-auth выдаётся (cookie)
- Mini App при загрузке авто-логинится через initData
- Fallback: если не в Telegram (нет initData) → обычный email-логин (3.4.2)
- Защита: проверка auth_date (initData не старше N часов), подпись обязательна
- Авто-создание: имя/username из Telegram, email null

## Задачи

| ID    | Задача                                 | Часов |
| ----- | -------------------------------------- | ----: |
| 8.1.1 | initData валидация (HMAC) + endpoint   |   2-3 |
| 8.1.2 | Авто-создание/связывание User + сессия |     2 |
| 8.1.3 | Mini App auto-login + email fallback   |   1-2 |

## Не делать

- ❌ Не делать обязательный email на входе (опционально позже)
- ❌ Не делать webhook auth — initData достаточно
- ❌ Не хранить initData (валидируем и отбрасываем)
