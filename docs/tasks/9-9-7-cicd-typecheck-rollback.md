---
id: '9.9.7'
phase: '9'
epic: '9.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 9 · P1 #7'
priority: P1
roles:
  - DEVOPS
depends_on:
  - '9.9.2'
estimated_hours: '1-2'
tags:
  - ci
  - deploy
  - review-fix
---

# Task 9.9.7: Deploy: typecheck/lint и откат при неуспешном smoke

## Цель

Сломанная сборка не доезжает до прода, а неуспешный релиз откатывается.

## Контекст

Deploy-workflow не гонял typecheck/lint; при падении smoke прод оставался на сломанной версии.

## Что должно быть сделано

1. Deploy: `pnpm lint && pnpm typecheck && pnpm test` перед сборкой образов.
2. Тегирование образов (`:previous` перед выкладкой), при падении smoke — `docker compose up -d` с предыдущим тегом и `exit 1`.
3. Уведомление в Telegram о результате.

## Критерии приёмки

- ✅ Ошибка типов → деплой падает до выкладки
- ✅ Падение smoke → прод возвращается на предыдущий образ

## Подсказки

-

## Не делать

-
