---
id: '27.4.8'
phase: '27'
epic: '27.4'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (UI-SEC-01). Релиз назначает владелец.'
ref_id: ''
review_ref: 'UI-SEC-01'
priority: P2
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, frontend, telegram]
---

# Task 27.4.8: Скрипт Telegram Web App только в Mini App

## Цель

Лендинг, публичная страница и кабинет не загружают сторонний скрипт Telegram.

## Контекст

- Замечание `UI-SEC-01` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `apps/web/nuxt.config.ts` подключает `telegram-web-app.js` на всех страницах.
- Кабинет показывает финансы и списки участников: сторонний скрипт там не нужен.
- Вход в Mini App определяется по наличию `window.Telegram.WebApp` — проверить все места, где это используется вне `/m/**`.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (по правилам ORCHESTRATION для этой области); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Найти все обращения к `window.Telegram` вне `/m/**`.
2. Подключать скрипт в layout или плагине Mini App; до загрузки — понятное состояние.
3. Тесты: на `/app/**` и `/` скрипта нет; на `/m/**` есть; Chrome QA входа в Mini App (эмуляция) и кабинет.

## Критерии приёмки

- ✅ Скрипт загружается только на `/m/**` (тест)
- ✅ Вход в Mini App работает (локально; Telegram — в релизной QA)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять логику входа
