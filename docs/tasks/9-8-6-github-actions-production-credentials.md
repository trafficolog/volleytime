---
id: '9.8.6'
phase: '9'
epic: '9.8'
status: done
sync_state: synced
last_reviewed: 2026-09-19
status_note: 'Dedicated restricted CI access, independent user/recovery access and all 12 required GitHub Secret names were verified without exposing values.'
roles:
  - DEVOPS
  - SECURITY
  - QA
depends_on:
  - '9.3.3'
  - '9.8.2'
  - '9.8.5'
estimated_hours: '1'
tags:
  - cicd
  - ssh
  - secrets
  - production
---

# Task 9.8.6: отдельные production credentials для GitHub Actions

## Цель

Настроить автоматический production deploy с отдельным отзывным SSH-ключом и GitHub Secrets, не копируя в GitHub пользовательский или recovery private key.

## Контекст

Production работает под пользователем `deploy`, но GitHub Secrets пока пусты. Для автоматизации нужен отдельный Ed25519-ключ `volleytime-github-actions`, который можно отозвать независимо. Обязательные значения production уже находятся в mode-0600 `/opt/volleytime/.env` и должны передаваться в GitHub без вывода значений.

## Что должно быть сделано

1. Создать отдельную Ed25519-пару с комментарием `github-actions@volleytime`.
2. Добавить public key в `deploy` authorized keys с OpenSSH-ограничением `restrict`.
3. Сохранить private key только как GitHub Secret `VPS_SSH_KEY`.
4. Создать `VPS_HOST` и обязательные production Secrets, которые проверяет env renderer.
5. Проверить CI, пользовательский и recovery SSH-доступ независимо.
6. Документировать ротацию и точечный отзыв CI-ключа.

## Критерии приёмки

- [x] `volleytime-github-actions` — отдельная Ed25519-пара; существующие private keys не переиспользованы.
- [x] Authorized-key entry содержит `restrict` и комментарий `github-actions@volleytime`.
- [x] CI private key аутентифицируется как `deploy` без пароля.
- [x] Пользовательский `volleytime` и `volleytime-recovery` продолжают аутентифицироваться.
- [x] GitHub содержит `VPS_HOST`, `VPS_SSH_KEY` и десять обязательных production env Secret names.
- [x] Значения Secrets отсутствуют в Git, GitHub Actions logs, task evidence и командном выводе.
- [x] Runbook описывает проверку, ротацию и отзыв только CI-ключа.

## Live evidence — 2026-09-19

- CI key fingerprint: `SHA256:zEGb20RkcxsX75bQnbcqnAQZoJ5eW7czwvqSPji51bI`; comment `github-actions@volleytime`; restricted authorized-key entry count: 1.
- Recovery key fingerprint: `SHA256:HdbQkkdmMFTslw7rW5fejkbKCBCi5BuT18FzIdaHhXw`; comment `volleytime-ops-recovery`; its missing public entry was restored with `restrict`.
- CI, normal production and recovery private keys each authenticated independently as `deploy` with `BatchMode=yes`.
- GitHub readback returned these names with update timestamps: `VPS_HOST`, `VPS_SSH_KEY`, `DOMAIN`, `DB_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `WEBHOOK_SECRET_PATH`, `WEBHOOK_SECRET_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BOT_INTERNAL_SECRET`, `WEB_URL`.
- Optional Sentry, S3, external-healthcheck and smoke-user Secrets were intentionally left unset.

## Не делать

- Не загружать в GitHub `volleytime` или `volleytime-recovery` private key.
- Не печатать `.env`, токены, пароли или private key.
- Не настраивать отсутствующие Sentry, S3 и Uptime credentials пустыми значениями.
- Не удалять рабочие пользовательский и recovery public keys.
