---
id: '9.4'
phase: '9'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'DNS volleytime.by → VPS, Mini App domain в BotFather.'
estimated_hours: '1-2'
depends_on: ['9.3']
---

# Epic 9.4: DNS + домен + Mini App config (BotFather)

**Цель.** Настроить DNS volleytime.by → VPS IP. Зарегистрировать Mini App domain в BotFather. Проверить HTTPS + Mini App открытие.

## Контекст

Решение 5: Mini App на корне volleytime.by. Telegram требует домен Mini App настроить в BotFather (иначе web_app кнопки не работают).

## Definition of Done

- DNS A-запись volleytime.by → VPS IP (+ www если нужно)
- Caddy получил Let's Encrypt сертификат (HTTPS зелёный)
- BotFather: Mini App domain = volleytime.by (/setdomain или Web App настройки)
- web_app кнопки в боте открывают Mini App
- Проверка: https://volleytime.by открывается, Mini App из бота работает

## Задачи

| ID    | Задача                                     | Часов |
| ----- | ------------------------------------------ | ----: |
| 9.4.1 | DNS + BotFather Mini App domain + проверка |   1-2 |

## Не делать

- ❌ Не забыть Mini App domain в BotFather (иначе web_app не откроется)
- ❌ Не использовать self-signed (Telegram требует валидный HTTPS)
