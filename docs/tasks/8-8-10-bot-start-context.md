---
id: '8.8.10'
phase: '8'
epic: '8.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 8 · P2 #10'
priority: P2
roles:
  - BACK
depends_on:
  - '8.8.2'
estimated_hours: '1'
tags:
  - bot
  - invites
  - review-fix
---

# Task 8.8.10: Бот: /start org_… показывает название группы и пригласившего

## Цель

Приглашённый видит в чате, куда его зовут.

## Контекст

Бот отвечал общим текстом без контекста.

## Что должно быть сделано

1. Web internal API `GET /api/internal/invites/:token/preview` (секрет) → название, число участников, пригласивший, статус.
2. Бот `/start org_<token>`: текст по дизайну screens-bot + кнопка «Открыть приглашение» (startapp=org_<token>); недействительный — причина.

## Критерии приёмки

- ✅ Сообщение содержит название группы

## Подсказки

- Бот не ходит в БД напрямую.

## Не делать

- ❌ Не раскрывать список участников
