---
id: '4.3'
phase: '4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Cross-cutting: централизованный policy layer.'
estimated_hours: '4-5'
depends_on: ['4.2']
---

# Epic 4.3: Permissions / Policy layer

**Цель.** Создать модуль `permissions/` с централизованными policy функциями. Используется во всех сервисах для проверки прав.

## Контекст

Решение в phase-card: вариант B — отдельный модуль `permissions/`. Функции типа `canManageOrg(user, org): boolean` и `requireOrgRole(user, org, roles): void` (throws ForbiddenError).

Без этого модуля каждый сервис будет копировать `if (member.role !== 'owner') throw ...` — ad-hoc, неконсистентно, легко забыть.

## Definition of Done

- Модуль `apps/web/modules/permissions/` создан с:
  - `policies.ts` — функции canX/requireX
  - `types.ts` — типы PermissionResult, Role
  - `errors.ts` — `ForbiddenError` с понятными сообщениями
  - `index.ts` — публичный API
- Покрытые сценарии:
  - `canManageOrganization(user, org)` — может ли user редактировать настройки org
  - `requireOrgOwner(user, org)` — throws если не owner
  - `requireOrgMember(user, org, allowedStatuses?)` — throws если не член
  - `canInviteToOrg(user, org)` — может ли создавать invites
  - `canManageMembers(user, org)` — может ли менять role / block
  - `canViewAudit(user, org)` — кто видит audit log (owner only)
- Все service функции в `organizations/`, `members/`, `invites/`, `audit/` используют requireX где нужно
- Unit-тесты для каждой policy функции
- Тесты edge cases: blocked member пытается что-то сделать, archived org не позволяет операций

## Задачи

| ID                                              | Задача                                      | Часов |
| ----------------------------------------------- | ------------------------------------------- | ----: |
| [4.3.1](../tasks/4-3-1-permission-functions.md) | Функции canX/requireX + типы                |     2 |
| [4.3.2](../tasks/4-3-2-permission-errors.md)    | ForbiddenError + интеграция с error handler |     1 |
| [4.3.3](../tasks/4-3-3-permission-tests.md)     | Unit-тесты + edge cases                     |   1-2 |

## Не делать

- ❌ Не делать декларативные декораторы (`@requireRole('owner')`) — функции более явные и тестируемые
- ❌ Не делать RBAC framework (CASL, accesscontrol) — overkill для нашего масштаба
- ❌ Не делать policy DSL — простые TypeScript функции достаточны
- ❌ Не делать UI permissions (что показывать кнопку или нет) — это в UI components отдельно (4.7)
