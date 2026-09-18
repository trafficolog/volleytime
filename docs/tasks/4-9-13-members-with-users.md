---
id: '4.9.13'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P2 #13 + Визуал «Состав»'
priority: P2
roles:
  - BACK
  - FE
depends_on:
  - '3.9.13'
estimated_hours: '2'
tags:
  - members
  - ui
  - review-fix
---

# Task 4.9.13: Состав с именами, username и фото

## Цель

API отдаёт участников с whitelisted-полями пользователя; UI показывает аватары, имена и роли.

## Контекст

API отдавал сырые строки members → UI «Участник #45».

## Что должно быть сделано

1. `memberService.list` → join users: `{ id, role, status, joinedAt, user: { id, name, telegramUsername, image } }` (без email/phone/telegram id).
2. UI `/m/orgs/:id/members`: `VtAvatar`, имя (fallback `@username` / «Игрок»), чип роли.

## Критерии приёмки

- ✅ В ответе нет `email`, `phone`, `telegramUserId`, `isRootAdmin`
- ✅ UI показывает имена и аватары

## Подсказки

- BigInt не должен попадать в JSON (см. 5.13.2).

## Не делать

- ❌ Не использовать `with: { user: true }`
