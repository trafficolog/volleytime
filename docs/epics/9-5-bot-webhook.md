---
id: '9.5'
phase: '9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Переключение бота с long-polling на webhook. Секретный путь + secret_token.'
estimated_hours: '2-3'
depends_on: ['9.2', '3.5.1']
---

# Epic 9.5: Bot webhook (переключение с long-polling)

**Цель.** Переключить бота с long-polling (Phase 3/8) на webhook. Секретный путь через Caddy, Telegram secret_token заголовок. Internal notify endpoint остаётся (внутренняя сеть).

## Контекст

Решения 3, 4: webhook на основном домене (/tg/webhook/<secret>), internal notify по внутренней сети. Phase 3 (3.5.1) сделал long-polling; production требует webhook (Telegram шлёт updates на HTTPS endpoint).

bot контейнер: два listener — webhook (публичный через Caddy, от Telegram) + internal notify (приватный, от web).

## Definition of Done

- Bot переключается на webhook режим в production (long-polling в dev сохраняется через env-флаг)
- Webhook endpoint: /tg/webhook/<secret-path>, проверка X-Telegram-Bot-Api-Secret-Token
- setWebhook вызывается при старте (URL + secret_token)
- Internal notify endpoint (web→bot) на отдельном порту, внутренняя сеть
- Caddy роутит /tg/webhook/* → bot
- Dev/prod переключение через env (BOT_MODE=polling|webhook)
- Webhook принимает updates, бот отвечает

## Задачи

| ID    | Задача                                                   | Часов |
| ----- | -------------------------------------------------------- | ----: |
| 9.5.1 | Webhook режим + setWebhook + secret защита               |   1-2 |
| 9.5.2 | Разделение webhook/internal listeners + env переключение |     1 |

## Не делать

- ❌ Не делать webhook без secret_token (Telegram спуфинг)
- ❌ Не выставлять internal notify наружу
- ❌ Не ломать long-polling для dev (env-флаг)
