---
id: '8.8.9'
phase: '8'
epic: '8.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 8 · P2 #9'
priority: P2
roles:
  - FE
depends_on:
  - '8.8.12'
estimated_hours: '1'
tags:
  - ux
  - review-fix
---

# Task 8.8.9: ErrorState и повтор на всех страницах Mini App

## Цель

Ошибка загрузки не превращается в пустой экран.

## Контекст

Часть страниц игнорировала ошибки `useFetch`.

## Что должно быть сделано

1. Аудит страниц `/m/**`: каждая загрузка → `ErrorState` с повтором; 401 → на вход; 403 → понятное сообщение.
2. Глобальный `error.vue` в стиле дизайна.

## Критерии приёмки

- ✅ Отключение API → на каждой странице ErrorState

## Подсказки

-

## Не делать

-
