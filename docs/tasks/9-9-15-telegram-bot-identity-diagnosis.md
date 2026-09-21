---
id: '9.9.15'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'Production diagnosis proved that the configured public bot username points to the legacy bot while the deployed token belongs to the current bot.'
roles:
  - BACKEND
  - DEVOPS
  - QA
depends_on:
  - '9.9.5'
  - '9.5.2'
estimated_hours: '0.5'
tags:
  - telegram
  - configuration
  - production
  - diagnosis
---

# Task 9.9.15: диагностика несовпадения Telegram bot identity

## Цель

Установить, почему production-ссылки приглашения открывают старого Telegram-бота, хотя Mini App и уведомления работают через актуального бота.

## Диагноз

Invite API не хранит готовый URL: при каждом GET/POST он строит его через `buildInviteDeeplink()` из `TELEGRAM_BOT_USERNAME`. Bot token используется независимо для Bot API, поэтому username и token могут указывать на разных ботов без startup/deploy ошибки.

Production readback 2026-09-21 подтвердил:

- `vt_web` получил `TELEGRAM_BOT_USERNAME` и `NUXT_PUBLIC_TELEGRAM_BOT_USERNAME` со значением legacy-бота `volleyballtime_bot`;
- `vt_bot` получил то же значение username;
- безопасный Telegram `getMe` для установленного production token вернул актуального бота `volleytimeby_bot`;
- GitHub Secrets `TELEGRAM_BOT_TOKEN` и `TELEGRAM_BOT_USERNAME` обновлялись отдельно и не проверяются на принадлежность одной bot identity;
- существующие invite tokens исправны: после коррекции username их URL будут пересобраны динамически.

## Корневая причина

Production deployment проверяет наличие обоих secret, но не проверяет, что `TELEGRAM_BOT_USERNAME` совпадает с `result.username` метода Telegram `getMe` для `TELEGRAM_BOT_TOKEN`. Независимый устаревший username прошёл fail-closed presence validation и был передан в web и bot containers.

## Критерии приёмки

- [x] Прослежен путь формирования invite URL от API до production env.
- [x] Username в web и bot containers считан без вывода token или других secrets.
- [x] Bot identity независимо подтверждена через Telegram `getMe`.
- [x] Доказано несовпадение `volleyballtime_bot` и `volleytimeby_bot`.
- [x] Исправление вынесено в отдельную Task 9.9.16 и не смешано с диагностикой.

## Не делать

- Не выводить Telegram token, invite tokens или Telegram user IDs.
- Не менять production secrets в диагностической задаче.
- Не считать ручную замену username достаточной без regression guard.
