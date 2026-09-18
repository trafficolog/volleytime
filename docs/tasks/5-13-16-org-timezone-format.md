---
id: '5.13.16'
phase: '5'
epic: '5.13'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 5 · P2 #16'
priority: P2
roles:
  - FE
depends_on: []
estimated_hours: '1'
tags:
  - i18n
  - timezone
  - review-fix
---

# Task 5.13.16: Время в часовом поясе организации

## Цель

Все даты событий отображаются в `organization.default_timezone`, а не в TZ устройства.

## Контекст

`toLocaleString` без `timeZone`.

## Что должно быть сделано

1. `packages/shared/src/datetime.ts`: `formatEventDate(date, tz)`, `formatTime`, `formatDay` на `Intl.DateTimeFormat('ru-RU', { timeZone })` + тесты.
2. Composable `useOrgTimezone(orgId)`; все страницы используют его.

## Критерии приёмки

- ✅ Europe/Minsk при TZ устройства UTC показывает минское время

## Подсказки

- Уведомления (8.8.5) используют ту же функцию.

## Не делать

- ❌ Не хранить время в локальной зоне
