---
id: '4.9.9'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P1 #9'
priority: P1
roles:
  - BACK
depends_on:
  - '4.9.3'
estimated_hours: '1'
tags:
  - members
  - invites
  - review-fix
---

# Task 4.9.9: Вышедший участник возвращается по инвайту

## Цель

`left`/`rejected` при redeem реактивируются, а не получают 409.

## Контекст

leave → новый инвайт → 409 «already a member» (уникальный индекс org+user).

## Что должно быть сделано

1. В redeem: существующая запись `left|rejected` → `UPDATE status, role, invite_id, invited_by, joined_at`; `blocked` → 403 `member.blocked`; `active|pending` → 409.
2. Тест: leave → redeem → active.

## Критерии приёмки

- ✅ Вернувшийся участник активен/pending по настройке инвайта
- ✅ Заблокированный не может вернуться через инвайт

## Подсказки

- Роль берётся из нового инвайта.

## Не делать

- ❌ Не создавать вторую строку участника
