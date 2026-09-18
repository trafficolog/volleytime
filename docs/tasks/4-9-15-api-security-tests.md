---
id: '4.9.15'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P2 #15'
priority: P2
roles:
  - QA
  - SECURITY
depends_on:
  - '4.9.1'
  - '4.9.4'
  - '4.9.7'
  - '4.9.11'
estimated_hours: '2-3'
tags:
  - tests
  - security
  - review-fix
---

# Task 4.9.15: API-тесты безопасности Phase 4 (4.8.2)

## Цель

Каждая находка ревью Phase 4 воспроизводится автотестом через HTTP-слой.

## Контекст

4 интеграционных сервисных теста; API не тестировался — ни одна находка не ловилась.

## Что должно быть сделано

1. Харнесс: `apps/web/server/__tests__/harness.ts` — вызов роутов через h3-app с подменой `requireAuth` (заголовок `x-test-user`), без поднятия Nuxt.
2. Кейсы: эскалация роли, отзыв чужого инвайта, pending → 403, cross-org чтение, query в tenant, 422 без SQL.

## Критерии приёмки

- ✅ Тесты падают на коде v0.1.0 и проходят после фиксов

## Подсказки

- Роуты импортируются как модули; auto-imports стабятся в setup файла.

## Не делать

- ❌ Не использовать Playwright для API
