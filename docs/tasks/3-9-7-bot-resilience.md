---
id: '3.9.7'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · P1 #7'
priority: P1
roles:
  - BACK
depends_on: []
estimated_hours: '1'
tags:
  - bot
  - grammy
  - review-fix
---

# Task 3.9.7: Бот: bot.catch, graceful shutdown, ответ на прочие сообщения

## Цель

Бот не падает от ошибки в хендлере, корректно останавливается по SIGINT/SIGTERM и отвечает на произвольные сообщения (AC 3.5.1/3.5.2).

## Контекст

Нет `bot.catch` — необработанная ошибка валит polling; нет обработки сигналов — Docker убивает процесс через 10 с; на прочие сообщения бот молчит.

## Что должно быть сделано

1. `registerErrorHandler(bot)`: `bot.catch(err => console.error('[bot] update failed', err.ctx.update.update_id, err.error))`.
2. `registerFallbackHandler(bot)`: `bot.on('message', ctx => ctx.reply('Я понимаю команды /start и /help …', { reply_markup: openAppKeyboard }))` — регистрируется последним.
3. `setupGracefulShutdown({ bot, servers, closeDb })`: `process.once('SIGINT'|'SIGTERM')` → `bot.stop()` → `server.close()` → exit 0.
4. Тесты на fallback-текст и что shutdown вызывает `stop`/`close`.

## Критерии приёмки

- ✅ Исключение в хендлере логируется, бот продолжает работу
- ✅ SIGTERM завершает процесс с кодом 0 после остановки серверов
- ✅ Сообщение «привет» получает ответ с кнопкой Mini App

## Подсказки

- В webhook-режиме `bot.stop()` не нужен, достаточно закрыть HTTP-серверы.

## Не делать

- ❌ Не отвечать на сообщения в группах (только private chat)
