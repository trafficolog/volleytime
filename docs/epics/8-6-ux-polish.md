---
id: '8.6'
phase: '8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Полировка Mini App под Telegram: loading/error/offline, перформанс.'
estimated_hours: '3-4'
depends_on: ['8.2']
---

# Epic 8.6: UX полировка (loading/error/offline)

**Цель.** Полировка Mini App под Telegram: единообразные loading states, обработка ошибок, offline/network handling, плавность.

## Контекст

Скелет (сессия 2). После того как foundation и уведомления работают — довести UX до релизного качества.

## Definition of Done

- Единообразные loading skeletons вместо спиннеров где уместно
- Error states с retry
- Offline detection (Telegram WebApp)
- Плавные переходы, haptics на ключевых действиях
- Performance: открытие < 2 сек на 4G

## Задачи

| ID                                              | Задача                                      | Часов |
| ----------------------------------------------- | ------------------------------------------- | ----: |
| [8.6.1](../tasks/8-6-1-loading-error-states.md) | Loading skeletons + error states унификация |   1-2 |
| [8.6.2](../tasks/8-6-2-offline-performance.md)  | Offline handling + performance              |   1-2 |

## Не делать

- ❌ Детали — в сессии 2
