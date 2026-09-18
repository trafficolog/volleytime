---
id: '8.4'
phase: '8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'NotifierService поверх grammY. Транспорт web→bot через internal HTTP.'
estimated_hours: '3-4'
depends_on: ['8.1', '8.3']
---

# Epic 8.4: NotifierService (поверх grammY)

**Цель.** Абстракция для отправки уведомлений: `notifier.send(userId, type, payload)` → резолвит telegram_id → рендерит шаблон → шлёт через бота. Fire-and-forget, вызывается после коммита транзакции.

## Контекст

Решение 5: NotifierService абстракция (не tight coupling, не event-queue). Решение 7: fire-and-forget после коммита.

**Архитектурный нюанс:** web (apps/web) и bot (apps/bot) — отдельные процессы. grammY instance живёт в боте. Web не может напрямую вызвать bot.api.sendMessage. Транспорт: web шлёт internal HTTP-запрос боту (`POST /internal/notify`), бот отправляет через grammY. Защита internal endpoint секретом.

## Definition of Done

- NotifierService в web: send(userId, type, payload), резолвит telegram_id, рендерит сообщение, шлёт боту
- Internal HTTP endpoint в боте: принимает {telegramId, text, keyboard?}, шлёт через grammY
- Защита internal endpoint (shared secret в заголовке)
- Fire-and-forget: ошибки логируются, не пробрасываются
- Шаблоны сообщений (русский) с подстановкой данных
- Вызовы notifier ВНЕ транзакций (после коммита)
- Graceful: у пользователя нет telegram_id → пропуск (не ошибка)

## Задачи

| ID    | Задача                                         | Часов |
| ----- | ---------------------------------------------- | ----: |
| 8.4.1 | NotifierService + internal transport (web→bot) |     2 |
| 8.4.2 | Шаблоны сообщений + рендеринг                  |   1-2 |

## Не делать

- ❌ Не делать очередь с retry — Phase 15
- ❌ Не делать event-driven шину — прямой вызов notifier
- ❌ Не блокировать бизнес-операцию доставкой
- ❌ Не слать вне Telegram (email/SMS) — Phase 15
