---
id: '27.4.5'
phase: '27'
epic: '27.4'
status: todo
release: ''
sync_state: synced
last_reviewed: 2026-11-10
status_note: 'Из аудита 2026-11-10 (BOT-01). Релиз назначает владелец.'
ref_id: ''
review_ref: 'BOT-01'
priority: P2
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [BACK]
depends_on: []
supersedes: []
decisions: []
estimated_hours: '2-4'
reference:
  spec: ''
  screens: []
tags: [audit-2026-11, security, bot]
---

# Task 27.4.5: Одна функция экранирования HTML для сообщений бота

## Цель

Все сообщения бота с `parse_mode: HTML` экранируют пользовательские данные одной проверенной функцией.

## Контекст

- Замечание `BOT-01` [аудита 2026-11-10](../operations/reviews/2026-11-10-project-audit.md); фаза [27](../phases/27-audit-hardening.md).
- **Как есть:** `esc` в `packages/core/src/notifier/templates.ts` и копия в `apps/bot/src/handlers/format.ts`; `/internal/notify` отправляет с `parse_mode: HTML`.
- Пользовательские данные: имена, названия групп и событий, места, комментарии.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (безопасность или доступ); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

## Что должно быть сделано

1. Перенести функцию в `packages/shared`, удалить копию; найти все места формирования HTML-текста и проверить экранирование.
2. Тесты: `<`, `>`, `&`, кавычки, длинные строки (предел Telegram 4096), эмодзи.

## Критерии приёмки

- ✅ Одна функция, все вызовы через неё (поиск в PR)
- ✅ Тесты на спецсимволы проходят
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Не делать

- ❌ Не менять тексты уведомлений
