---
id: '9.9.12'
phase: '9'
epic: '9.9'
status: done
sync_state: local
last_reviewed: 2026-09-19
status_note: 'Retry and fatal bot logs now use the shared recursive sanitizer; the focused test, full repository gate, BotFather token rotation and VPS secret update are complete.'
roles:
  - BACKEND
  - DEVOPS
  - QA
depends_on:
  - '9.9.10'
estimated_hours: '1'
tags:
  - telegram
  - secrets
  - logging
  - security
---

# Task 9.9.12: secret-safe Telegram error logs

## Цель

Не допускать попадания Telegram bot token и других URL credentials в retry/fatal logs при сетевых ошибках grammY/node-fetch.

## Контекст

При timeout `setMyCommands` raw `HttpError` содержит вложенный `FetchError`, а его message/stack включает URL вида `https://api.telegram.org/bot<TOKEN>/...`. Текущий `withRetries` передаёт весь объект в `console.error`, поэтому production log раскрывает token.

## Что должно быть сделано

1. Добавить общий sanitizer для operational errors, который рекурсивно заменяет Telegram `/bot<TOKEN>/` и credentials в URL на `[REDACTED]`.
2. `withRetries` и fatal startup log выводят только sanitized representation.
3. Сохранить полезные поля диагностики: error name/message/code/cause без raw request object.
4. Тест с реалистичной вложенной ошибкой доказывает отсутствие token во всех аргументах logger.
5. Уже раскрытый production token перевыпускается через BotFather; code fix не считается заменой ротации.

## Критерии приёмки

- [x] Retry log не содержит исходный token или полный Telegram bot URL.
- [x] Fatal startup log использует тот же sanitizer.
- [x] Error name, безопасное message и network code остаются видимыми.
- [x] Focused tests и обязательный repository gate проходят.
- [x] Новый token установлен на VPS и старый отозван через BotFather.

## Не делать

- Не скрывать весь error message целиком: код/тип сетевой ошибки нужен для диагностики.
- Не печатать env или request headers.
- Не считать удаление старых логов достаточным без ротации token.
