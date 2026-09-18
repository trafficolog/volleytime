---
id: '3.9.12'
phase: '3'
epic: '3.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 3 · Визуал'
priority: P2
roles:
  - FE
depends_on:
  - '3.9.13'
estimated_hours: '2'
tags:
  - ui
  - auth
  - a11y
  - review-fix
---

# Task 3.9.12: UI Phase 3: главная с CTA, логин «Изменить email / Отправить повторно», lang/title

## Цель

Привести главную и экран входа к дизайну «6 Авторизация» и базовой доступности.

## Контекст

Главная — только надпись без CTA; логин без «изменить email / отправить повторно»; нет `lang="ru"` и `<title>`.

## Что должно быть сделано

1. `nuxt.config` → `app.head: { htmlAttrs: { lang: 'ru' }, title: 'Volley Time', meta: [viewport, theme-color] }`.
2. `pages/index.vue`: бренд, оффер, CTA «Открыть в Telegram» (`https://t.me/<bot>`) и «Войти по email».
3. `pages/auth/login.vue`: шаг кода — «Изменить email», «Отправить код повторно» с таймером 60 с, ошибки на русском, `autocomplete="one-time-code"`.

## Критерии приёмки

- ✅ `<html lang="ru">`, `<title>` на всех страницах
- ✅ На главной 2 CTA
- ✅ На шаге кода можно сменить email и повторно отправить код (после таймера)

## Подсказки

- Использовать компоненты из 3.9.13 (`VtButton`, `VtField`).

## Не делать

- ❌ Не делать маркетинговый лендинг — только вход
