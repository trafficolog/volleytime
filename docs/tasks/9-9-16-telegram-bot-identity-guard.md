---
id: '9.9.16'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-21
status_note: 'The deployment guard, corrected GitHub Secret, production rollout, live identity parity, invite URL, backup/smoke and immutable v0.1.5 publication are verified.'
roles:
  - BACKEND
  - DEVOPS
  - QA
depends_on:
  - '9.9.15'
estimated_hours: '1-2'
tags:
  - telegram
  - configuration
  - deployment
  - production
---

# Task 9.9.16: Telegram bot identity deployment guard

## Цель

Исправить production invite links на актуального `@volleytimeby_bot` и не допустить повторного расхождения `TELEGRAM_BOT_USERNAME` с владельцем `TELEGRAM_BOT_TOKEN`.

## Что должно быть сделано

1. Добавить secret-safe verifier Telegram identity: вызвать `getMe`, нормализовать `@`/регистр и сравнить username.
2. При mismatch, сетевой ошибке или невалидном ответе завершать проверку до формирования и загрузки production env.
3. Не включать token, Bot API URL или raw Telegram response в error output.
4. Подключить verifier в production deploy workflow.
5. Обновить GitHub Secret `TELEGRAM_BOT_USERNAME` на `volleytimeby_bot`.
6. Продвинуть проверенный `main` в `prod`, выполнить backup/deploy/smoke и опубликовать patch release `v0.1.5`.

## Критерии приёмки

- [x] Regression test падает до реализации на mismatch-сценарии.
- [x] Совпадающий username проходит с нормализацией `@` и регистра.
- [x] Несовпадающий username блокирует deploy.
- [x] Ошибки verifier не раскрывают token или tokenized URL.
- [x] Deploy workflow запускает guard до записи `.env.production`.
- [x] Production web/bot username и Telegram `getMe` равны `volleytimeby_bot`.
- [x] Invite URL формируется через `https://t.me/volleytimeby_bot?start=org_…`.
- [x] Production health/smoke и обязательные repository/CI gates проходят.

## Не делать

- Не менять invite tokens или записи организаций.
- Не логировать Telegram token, user IDs или содержимое production env.
- Не переносить bot identity lookup в пользовательский request path.

## Repository evidence

- RED: focused test — 3/3 failed because the verifier module was absent; after correcting only the Windows file-URL harness, the same three tests still failed at the expected missing-module boundary.
- GREEN: identity guard + deploy contract — 2 files, 21 tests passed.
- Network dependency is replaced only at the external `fetch` boundary; normalization, comparison and secret-safe error handling execute in the real verifier.

## Production evidence

- PR #34 merged as `67bbfe89acaac04992b8128d45cb1b40f8acc75c`; all three pull-request CI jobs passed.
- GitHub Secret `TELEGRAM_BOT_USERNAME` was replaced without reading or printing secret values; its update timestamp is `2026-09-21T20:18:26Z`.
- Production workflow `35650271644` passed source gate, database-backed tests, real `getMe` identity guard, secret rendering/upload, release-local backup, verified-bundle build/deploy and smoke.
- Independent VPS readback matched Git HEAD, public web health and bot health on exact SHA `67bbfe89acaac04992b8128d45cb1b40f8acc75c`.
- `vt_web` server/public config, `vt_bot` config and Telegram `getMe` all reported `volleytimeby_bot`; no token or Telegram user ID was printed.
- A synthetic non-persisted sample produced `https://t.me/volleytimeby_bot?start=org_SYNTHETIC`; production invite tokens remain unchanged and are combined with the same runtime username dynamically.
- Web, bot and PostgreSQL were healthy with restart count `0`; bot remained in approved `polling` mode. Release backup `volleytime_20260921_202106.sql.gz` was present.
- Annotated tag and public GitHub Release `v0.1.5` point to the audited production SHA.
