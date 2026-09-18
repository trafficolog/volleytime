---
id: '3.3'
phase: '3'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Самый рискованный эпик: проверка that better-auth подходит. Fallback на Lucia если нет.'
estimated_hours: '6-8'
depends_on: ['3.2']
---

# Epic 3.3: better-auth setup

**Цель.** Создать пакет `packages/auth` с better-auth, настроить email-code provider (с dev console.log) и Telegram identity (через initData валидация).

## Контекст

Это **самый рискованный эпик** Phase 3. Если better-auth не подойдёт под Telegram identity workflow — нужно переходить на Lucia. Решение принимается **в момент реализации**, не сейчас.

Auth-схема — заимствована из Level Volley:

- 6-значный код, TTL 10 мин
- Rate limit: 1 код / 60 сек, 5 попыток на код
- В dev — код пишется в console.log (с пометкой `[DEV EMAIL]`)
- В Phase 9 — подключается Unisender Go

Telegram identity:

- Mini App открывается с `initData` в URL
- Сервер валидирует HMAC через bot token (см. [Telegram WebApp validation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app))
- Если user не существует → создать, привязать `telegram_user_id`
- Если существует → создать session

Account linking:

- Один User → несколько Account (email, telegram)
- Через UI: «Привязать Telegram» / «Привязать email»

## Definition of Done

- Создан пакет `packages/auth`
- better-auth установлен и настроен
- Email-code provider работает:
  - `POST /api/auth/send-code { email }` → код в console.log
  - `POST /api/auth/verify { email, code }` → создаёт/находит User, открывает session
  - Rate limit: 1 код / 60 сек (через Redis или БД)
  - 5 попыток ввода кода → блокировка кода
- Telegram identity provider работает:
  - Сервер-валидация `initData` через HMAC
  - При успехе: User создан/найден, session открыта
- Account linking работает:
  - Auth'нутый пользователь может привязать второй identity
  - При попытке привязать identity, уже привязанный к другому User → 409
- Сессии хранятся в БД (Drizzle Session model)
- Cookies настроены правильно (httpOnly, secure в prod, SameSite=Lax)
- Если better-auth не работает (например, не поддерживает Telegram identity нормально) — задокументирован fallback на Lucia (см. 3.3.4)

## Задачи

| ID                                           | Задача                                                        | Часов |
| -------------------------------------------- | ------------------------------------------------------------- | ----: |
| [3.3.1](../tasks/3-3-1-better-auth-base.md)  | better-auth базовая установка + email-code provider           |     2 |
| [3.3.2](../tasks/3-3-2-email-dev-logger.md)  | Dev email logger (console.log) с placeholder для Unisender Go |     1 |
| [3.3.3](../tasks/3-3-3-telegram-identity.md) | Telegram identity через initData HMAC валидация               |   2-3 |
| [3.3.4](../tasks/3-3-4-account-linking.md)   | Account linking (email + Telegram)                            |   1-2 |

## Не делать

- ❌ Не подключать реальный email-провайдер (Unisender Go — это Phase 9)
- ❌ Не делать OAuth-провайдеры (Google, Apple) — не нужны
- ❌ Не делать пароли — passwordless only
- ❌ Не делать 2FA — лишнее на MVP
- ❌ Не пытаться форсить SMS — Telegram достаточно

## Открытые вопросы

- **Fallback на Lucia.** Если в задаче 3.3.3 (Telegram identity) better-auth окажется неподходящим — переходим на Lucia v3 + кастомная имплементация email-code и Telegram. Это переписывание 3.3.1-3.3.4 (~6 часов работы), но не блокирует другие эпики Phase 3.
- **Где хранить sessions.** В БД (через Drizzle Session model) или в Redis? Стартуем с БД (проще), при росте — мигрируем в Redis. Решение в 3.3.1.
