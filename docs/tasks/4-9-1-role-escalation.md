---
id: '4.9.1'
phase: '4'
epic: '4.9'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 4 · P0 #1'
priority: P0
roles:
  - BACK
  - SECURITY
depends_on: []
estimated_hours: '1-2'
tags:
  - permissions
  - members
  - security
  - review-fix
---

# Task 4.9.1: Эскалация до owner: валидация роли, запрет своей роли, смена ролей — только owner

## Цель

Исключить назначение роли `owner` через `PATCH members/:id` и смену ролей не-владельцем.

## Контекст

Хендлер не использует `ChangeMemberRoleInput`; `body.role` уходит в сервис как есть. Организатор: `PATCH self {role:"owner"}` → 200, затем owner-only `PATCH /organizations/:id` → 200.

## Что должно быть сделано

1. Хендлер: `requireOrgOwner(member)`; `const { role } = ChangeMemberRoleInput.parse(await readBody(event))`.
2. `memberService.changeRole(ctx, memberId, role)`: повторный `ChangeMemberRoleInput.shape.role.parse(role)`; `if (target.userId === ctx.userId) throw new CannotChangeOwnRoleError()`; owner-роль неизменяема (как было).
3. `tenant` уже проверяет членство; добавить проверку `target.organizationId === orgId` в сервис (defense-in-depth).
4. Коды: `member.cannot_change_own_role` → 422.

## Критерии приёмки

- ✅ `{role:'owner'}` → 422
- ✅ Организатор меняет чью-то роль → 403
- ✅ Owner меняет свою роль → 422
- ✅ Сервисный и API-тест на сценарий эскалации

## Подсказки

- `z.enum([...])` без `owner` уже есть в `ChangeMemberRoleInput`.

## Не делать

- ❌ Не проверять права только в UI
