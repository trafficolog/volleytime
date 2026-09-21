---
id: '9.4.1'
phase: '9'
epic: '9.4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'DNS and live HTTPS are verified; BotFather domain/menu, real Mini App opening, deeplinks and initData login still require client-side acceptance.'
roles:
  - DEVOPS
depends_on:
  - '9.3.1'
  - '9.2.2'
estimated_hours: '1-2'
tags:
  - dns
  - telegram
  - botfather
---

# Task 9.4.1: DNS + BotFather Mini App domain + проверка

## Цель

DNS A-запись volleytime.by → VPS IP. Зарегистрировать Mini App domain в BotFather. Проверить HTTPS и открытие Mini App из бота.

## Контекст

Решение 5: Mini App на корне volleytime.by. Telegram требует домен Mini App настроить в BotFather — иначе web_app кнопки (8.2, 8.3) не откроют приложение.

## Что должно быть сделано

1. **DNS:**
   - У регистратора домена volleytime.by: A-запись `@` → VPS IP
   - Опц: `www` → VPS IP (или редирект)
   - Подождать распространения DNS (минуты-часы), проверить `dig volleytime.by`

2. **Проверить Caddy HTTPS:**
   - После DNS Caddy (9.2.2) получит Let's Encrypt сертификат автоматически
   - https://volleytime.by → зелёный замок, отдаёт Nuxt
   - Если сертификат не выдался — проверить DNS, порты 80/443 (firewall 9.3.1), логи caddy

3. **BotFather Mini App domain:**
   - `/mybots` → выбрать бота → Bot Settings → Menu Button / Web App
   - Или `/setdomain` — указать volleytime.by
   - Настроить Menu Button (кнопка-меню бота открывает Mini App) на https://volleytime.by/m/

4. **Проверка end-to-end:**
   - /start в боте → кнопка «Открыть Volley Time» → Mini App открывается
   - event_ deeplink (8.3.1) → открывает страницу события
   - Mini App авто-логинится (initData, 8.1.3)
   - Menu Button бота открывает приложение

5. **Обновить env:** NUXT_PUBLIC_MINIAPP_BASE_URL=https://volleytime.by, WEBHOOK_URL.

## Критерии приёмки

- ✅ DNS volleytime.by → VPS IP (распространился)
- ✅ HTTPS работает (Let's Encrypt, зелёный замок)
- ✅ https://volleytime.by отдаёт Mini App
- ✅ BotFather: Mini App domain = volleytime.by, Menu Button настроен
- ✅ /start → кнопка открывает Mini App
- ✅ web_app deeplinks (event_) работают
- ✅ Авто-логин в Mini App работает

## Подсказки

- **BotFather domain ОБЯЗАТЕЛЕН** — без него web_app кнопки показывают ошибку/не открываются. Частая забытая настройка.
- **DNS до Caddy HTTPS** — Caddy получает сертификат только когда домен резолвится на сервер (Let's Encrypt проверяет). Порядок: DNS → Caddy auto-cert.
- **Menu Button** — синяя кнопка слева от поля ввода в боте, удобный вход в Mini App.
- **.by домен** — белорусская зона, регистратор может требовать особенностей. Проверить управление DNS-записями.

## Не делать

- ❌ Не забыть BotFather Mini App domain
- ❌ Не ждать HTTPS до настройки DNS (Caddy не получит cert)
- ❌ Не использовать self-signed
