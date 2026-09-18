---
id: '4.3.1'
phase: '4'
epic: '4.3'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
  - SECURITY
depends_on:
  - '4.2.2'
estimated_hours: '2'
tags:
  - permissions
  - security
  - policy
---

# Task 4.3.1: Permission functions (canX / requireX) + типы

## Цель

Создать модуль `apps/web/modules/permissions/` с типизированными функциями для проверки прав. Используются во всех API endpoints и UI компонентах.

## Контекст

Решение 14 в phase-card: централизованный модуль `permissions/`. Функции делятся на:

- **canX** — возвращают boolean (для UI: показать/скрыть кнопку)
- **requireX** — выбрасывают `ForbiddenError` если не разрешено (для API endpoints)

## Что должно быть сделано

1. **Структура модуля:**

   ```
   apps/web/modules/permissions/
   ├── policies.ts       # сами функции canX/requireX
   ├── errors.ts         # ForbiddenError
   ├── types.ts          # типы
   └── index.ts          # публичный API
   ```

2. **`types.ts`:**

   ```ts
   import type { OrganizationMember, Organization, User } from '@volley-time/db'

   export type Role = 'owner' | 'organizer' | 'assistant' | 'player'
   export type ActiveStatus = 'active' | 'pending'

   export interface PermissionResult {
     allowed: boolean
     reason?: string
   }
   ```

3. **`errors.ts`:**

   ```ts
   export class ForbiddenError extends Error {
     code: string
     constructor(code: string, message: string) {
       super(message)
       this.code = code
       this.name = 'ForbiddenError'
     }
   }
   ```

4. **`policies.ts`** — основные функции:

   ```ts
   import type { OrganizationMember, Organization, User } from '@volley-time/db'
   import { ForbiddenError } from './errors'

   /**
    * Member statuses that allow "active participation" in org operations.
    */
   const ACTIVE_STATUSES = ['active', 'pending'] as const

   // ─── Boolean checks (for UI) ────────────────────────────────────────

   export function isOrgMember(member: OrganizationMember | null): boolean {
     if (!member) return false
     return (ACTIVE_STATUSES as readonly string[]).includes(member.status)
   }

   export function isOrgOwner(member: OrganizationMember | null): boolean {
     return !!member && member.role === 'owner' && member.status === 'active'
   }

   export function canManageOrganization(member: OrganizationMember | null): boolean {
     return isOrgOwner(member)
   }

   export function canManageMembers(member: OrganizationMember | null): boolean {
     return isOrgOwner(member)
   }

   export function canInviteToOrg(member: OrganizationMember | null): boolean {
     // Phase 4: только owner. В Phase 5+ organizer/assistant тоже могут
     return isOrgOwner(member)
   }

   export function canViewAuditLog(member: OrganizationMember | null): boolean {
     return isOrgOwner(member)
   }

   export function canViewOrgMembers(member: OrganizationMember | null): boolean {
     return isOrgMember(member)
   }

   // ─── Throwing checks (for API endpoints) ────────────────────────────

   export function requireOrgMember(member: OrganizationMember | null): void {
     if (!isOrgMember(member)) {
       throw new ForbiddenError(
         'permission.not_member',
         'You are not an active member of this organization',
       )
     }
   }

   export function requireOrgOwner(member: OrganizationMember | null): void {
     if (!isOrgOwner(member)) {
       throw new ForbiddenError(
         'permission.not_owner',
         'Only the organization owner can perform this action',
       )
     }
   }

   export function requireCanManageMembers(member: OrganizationMember | null): void {
     if (!canManageMembers(member)) {
       throw new ForbiddenError(
         'permission.cannot_manage_members',
         'You do not have permission to manage members',
       )
     }
   }

   export function requireCanInvite(member: OrganizationMember | null): void {
     if (!canInviteToOrg(member)) {
       throw new ForbiddenError(
         'permission.cannot_invite',
         'You do not have permission to create invites',
       )
     }
   }

   export function requireCanViewAudit(member: OrganizationMember | null): void {
     if (!canViewAuditLog(member)) {
       throw new ForbiddenError(
         'permission.cannot_view_audit',
         'You do not have permission to view audit log',
       )
     }
   }

   // ─── Organization-level checks ──────────────────────────────────────

   export function isOrgActive(org: Organization | null): boolean {
     return !!org && org.status === 'active'
   }

   export function requireOrgActive(org: Organization | null): void {
     if (!org) {
       throw new ForbiddenError('permission.org_not_found', 'Organization not found')
     }
     if (org.status === 'archived') {
       throw new ForbiddenError('permission.org_archived', 'Organization is archived')
     }
     if (org.status === 'suspended') {
       throw new ForbiddenError('permission.org_suspended', 'Organization is suspended')
     }
   }
   ```

5. **`index.ts`** — публичный API:
   ```ts
   export {
     isOrgMember,
     isOrgOwner,
     canManageOrganization,
     canManageMembers,
     canInviteToOrg,
     canViewAuditLog,
     canViewOrgMembers,
     isOrgActive,
     requireOrgMember,
     requireOrgOwner,
     requireCanManageMembers,
     requireCanInvite,
     requireCanViewAudit,
     requireOrgActive,
   } from './policies'

   export { ForbiddenError } from './errors'
   export type { Role, ActiveStatus, PermissionResult } from './types'
   ```

## Критерии приёмки

- ✅ Модуль `permissions/` создан со всеми файлами
- ✅ Каждая canX функция возвращает boolean (никаких side effects)
- ✅ Каждая requireX выбрасывает `ForbiddenError` с понятным message + code
- ✅ Blocked member НЕ считается active (isOrgMember = false)
- ✅ Left/rejected member НЕ считается active
- ✅ Pending member считается active (для bookings и т.д.)
- ✅ Только owner может: manage organization, manage members, invite, view audit
- ✅ Все типы строгие, никаких `any`
- ✅ Импорт работает: `import { requireOrgOwner } from '~/modules/permissions'`

## Подсказки

- **Why pending counts as "active"?** Pending — это «ждёт подтверждения», но user уже видит организацию, читает события, может делать bookings (которые тоже будут pending до approval). В Phase 5+ это пригодится. Сейчас просто закладываем pattern.
- **`canX` vs `requireX`:** разделение позволяет в UI делать `v-if="canManageMembers(member)"` без try/catch, а в API endpoints — однострочный `requireCanManageMembers(member)`.
- **Future-proof:** в Phase 5+ можем расширить (например, `canManageEvents`, `canConfirmPayment` для assistant). Существующий API не сломается.

## Не делать

- ❌ Не делать декоратор-стайл (`@RequireRole('owner')`) — функции явнее и testable
- ❌ Не делать RBAC library (CASL, accesscontrol) — overkill
- ❌ Не подключать проверки к ORM-уровню (Drizzle hooks) — явные вызовы лучше
- ❌ Не делать caching результатов — функции дешёвые

## ADR 2026-09-17: матрица прав Phase 4 (ревью v0.1.0, находка 4 P1#6 → Task 4.9.6)

Реализация (коммит e5fd27c) расширила права организатора без обновления карточки. Решение — **обновить спеку, а не откатывать код**: дизайн «Кабинет организатора» предполагает, что организатор ведёт игроков.

| Действие                                                | owner | organizer | assistant / player | pending |
| ------------------------------------------------------- | :---: | :-------: | :----------------: | :-----: |
| Карточка организации, статус своей заявки               |  ✅   |    ✅     |         ✅         |   ✅    |
| Состав, события, свои записи                            |  ✅   |    ✅     |         ✅         |   ❌    |
| Инвайт с ролью `player`                                 |  ✅   |    ✅     |         ❌         |   ❌    |
| Инвайт с ролью `organizer` / `assistant`                |  ✅   |    ❌     |         ❌         |   ❌    |
| Approve / reject / block / unblock игрока или помощника |  ✅   |    ✅     |         ❌         |   ❌    |
| Модерация organizer                                     |  ✅   |    ❌     |         ❌         |   ❌    |
| Смена ролей                                             |  ✅   |    ❌     |         ❌         |   ❌    |
| Аудит                                                   |  ✅   |    ✅     |         ❌         |   ❌    |
| Настройки, архив                                        |  ✅   |    ❌     |         ❌         |   ❌    |

Функции: `canInviteRole/requireCanInviteRole`, `canModerate/requireCanModerate`, `requireOrgOwner` (роли), `requireOrgMember` (только `active`, см. 4.9.7).
