---
id: '4.9.4'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P1 #4'
priority: P1
roles:
  - BACK
  - SECURITY
depends_on: []
estimated_hours: '0.5'
tags:
  - invites
  - tenant
  - security
  - review-fix
---

# Task 4.9.4: Отзыв инвайта scoped по организации

## Цель

Инвайт отзывается только в своей организации; чужой → 404.

## Контекст

`inviteService.revoke(inviteId)` без `organization_id`: организатор A отозвал инвайт B через URL своей организации.

## Что должно быть сделано

1. `revoke(ctx, orgId, inviteId)`: `UPDATE … WHERE id = ? AND organization_id = ? RETURNING` → 0 строк → `InviteNotFoundError`.
2. Хендлер передаёт `event.context.organization.id`.
3. Security-тест.

## Критерии приёмки

- ✅ Отзыв инвайта другой организации → 404, инвайт не изменён

## Подсказки

- `listByOrg` уже фильтрует по org.

## Не делать

- ❌ Не полагаться на проверку в хендлере без условия в SQL
