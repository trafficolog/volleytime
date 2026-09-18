---
id: '3.9.8'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · P1 #8'
priority: P1
roles:
  - BACK
  - SECURITY
depends_on:
  - '3.9.4'
estimated_hours: '1-2'
tags:
  - auth
  - linking
  - review-fix
---

# Task 3.9.8: Эндпоинт привязки Telegram к аккаунту (/api/auth/link/telegram) с 409

## Цель

Закрыть DoD 6 Phase 3: пользователь, вошедший по email, привязывает Telegram через initData.

## Контекст

`linkTelegramToUser` реализован и протестирован, но API нет. Ошибки `AccountAlreadyLinkedError` / `AccountLinkedToOtherUserError` должны отдаваться как 409.

## Что должно быть сделано

1. В telegram-плагин better-auth добавить `POST /link/telegram` с `sessionMiddleware`: `linkTelegramToUser(session.user.id, initData, botToken)`.
2. Маппинг: оба доменных исключения → `APIError('CONFLICT')` (409) с кодами `account.already_linked` / `account.linked_to_other_user`; невалидная подпись → 401.
3. Интеграционный тест через `auth.handler`.

## Критерии приёмки

- ✅ Без сессии → 401
- ✅ Успешная привязка → 200, `users.telegram_user_id` заполнен
- ✅ Повтор / чужой Telegram → 409 с кодом

## Подсказки

- `linkTelegramToUser` уже валидирует initData.

## Не делать

- ❌ Не создавать нового пользователя при привязке
