---
id: '4.9.14'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P2 #14'
priority: P2
roles:
  - DB
depends_on: []
estimated_hours: '1'
tags:
  - migrations
  - review-fix
---

# Task 4.9.14: Миграция: FK organization_members.invite_id, enum для role_to_assign/default_member_status

## Цель

Целостность ссылок и допустимых значений на уровне БД.

## Контекст

FK `invite_id` так и не добавлен; `role_to_assign` и `default_member_status` — text.

## Что должно быть сделано

1. `invite_id` → FK `invite_links(id) ON DELETE SET NULL`.
2. `role_to_assign` → `member_role` (без owner — CHECK), `default_member_status` → `member_status_default` (USING cast).
3. rollback-скрипт.

## Критерии приёмки

- ✅ `INSERT` с role `superadmin` отвергается БД
- ✅ Миграция применяется на данных v0.1.0

## Подсказки

- Перед cast — `UPDATE … WHERE role_to_assign NOT IN (...)` не требуется: API всегда валидировал.

## Не делать

- ❌ Не переименовывать колонки
