---
id: '9.9.16'
phase: '9'
epic: '9.9'
status: in_progress
sync_state: local
last_reviewed: 2026-09-21
status_note: 'Diagnosis 9.9.15 is complete; implementation must fail closed when the configured username does not belong to the production Telegram token, then correct and redeploy production.'
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
- [ ] Production web/bot username и Telegram `getMe` равны `volleytimeby_bot`.
- [ ] Invite URL формируется через `https://t.me/volleytimeby_bot?start=org_…`.
- [ ] Production health/smoke и обязательные repository/CI gates проходят.

## Не делать

- Не менять invite tokens или записи организаций.
- Не логировать Telegram token, user IDs или содержимое production env.
- Не переносить bot identity lookup в пользовательский request path.

## Repository evidence

- RED: focused test — 3/3 failed because the verifier module was absent; after correcting only the Windows file-URL harness, the same three tests still failed at the expected missing-module boundary.
- GREEN: identity guard + deploy contract — 2 files, 21 tests passed.
- Network dependency is replaced only at the external `fetch` boundary; normalization, comparison and secret-safe error handling execute in the real verifier.
