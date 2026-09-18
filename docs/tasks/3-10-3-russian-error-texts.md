---
id: '3.10.3'
phase: '3'
epic: '3.10'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Ревью v0.1.1 · Phase 3 · P2'
priority: P2
roles:
  - BACK
  - FE
depends_on: []
estimated_hours: '1'
tags:
  - i18n
  - errors
  - review2-fix
---

# Task 3.10.3: Русские тексты доменных ошибок (привязка Telegram и вход)

## Цель

Пользователь не видит английских сообщений вроде «Telegram already linked to this user».

## Контекст

Часть доменных ошибок возвращает англоязычный `message`; фронт показывает его, если нет перевода по коду.

## Что должно быть сделано

1. Перевести сообщения ошибок привязки/входа (`account.already_linked`, `account.linked_to_other_user`, `telegram.invalid`) и добавить коды в словарь `apiErrorMessage`.
2. Проверить остальные ветки auth-плагина на англоязычные тексты.

## Критерии приёмки

- ✅ Повторная привязка → русский текст
- ✅ Неверный initData → русский текст

## Подсказки

- Коды остаются английскими — переводится только `message`.

## Не делать

- ❌ Не менять коды ошибок
