---
id: '4.3.3'
phase: '4'
epic: '4.3'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - QA
  - SECURITY
depends_on:
  - '4.3.1'
  - '4.3.2'
estimated_hours: '1-2'
tags:
  - tests
  - permissions
  - security
---

# Task 4.3.3: Unit-тесты + edge cases для permissions

## Цель

Покрыть unit-тестами все policy функции из `permissions/policies.ts`. Особое внимание edge cases: blocked, archived org, null member.

## Контекст

Permissions — security-критический код. Любая ошибка здесь означает дыру в multi-tenancy. Тесты должны быть thorough.

## Что должно быть сделано

1. **`apps/web/modules/permissions/__tests__/policies.test.ts`:**

   ```ts
   import { describe, test, expect } from 'vitest'
   import type { OrganizationMember, Organization } from '@volley-time/db'
   import {
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
     ForbiddenError,
   } from '../'

   // Helpers
   const makeMember = (overrides: Partial<OrganizationMember> = {}): OrganizationMember => ({
     id: 1,
     organizationId: 1,
     userId: 1,
     role: 'player',
     status: 'active',
     joinedAt: new Date(),
     invitedByUserId: null,
     inviteId: null,
     ratingInOrg: null,
     createdAt: new Date(),
     updatedAt: new Date(),
     ...overrides,
   })

   const makeOrg = (overrides: Partial<Organization> = {}): Organization => ({
     id: 1,
     slug: 'test-org',
     name: 'Test Org',
     description: null,
     city: null,
     sportType: 'volleyball',
     ownerUserId: 1,
     status: 'active',
     defaultMemberStatus: 'active',
     defaultCurrency: 'BYN',
     defaultTimezone: 'Europe/Minsk',
     publicPageEnabled: 0,
     createdAt: new Date(),
     updatedAt: new Date(),
     ...overrides,
   })

   describe('isOrgMember', () => {
     test('active player is member', () => {
       expect(isOrgMember(makeMember({ status: 'active', role: 'player' }))).toBe(true)
     })

     test('pending is member', () => {
       expect(isOrgMember(makeMember({ status: 'pending' }))).toBe(true)
     })

     test('blocked is NOT member', () => {
       expect(isOrgMember(makeMember({ status: 'blocked' }))).toBe(false)
     })

     test('left is NOT member', () => {
       expect(isOrgMember(makeMember({ status: 'left' }))).toBe(false)
     })

     test('rejected is NOT member', () => {
       expect(isOrgMember(makeMember({ status: 'rejected' }))).toBe(false)
     })

     test('null is NOT member', () => {
       expect(isOrgMember(null)).toBe(false)
     })
   })

   describe('isOrgOwner', () => {
     test('active owner is owner', () => {
       expect(isOrgOwner(makeMember({ role: 'owner', status: 'active' }))).toBe(true)
     })

     test('pending owner is NOT owner (must be active)', () => {
       expect(isOrgOwner(makeMember({ role: 'owner', status: 'pending' }))).toBe(false)
     })

     test('blocked owner is NOT owner', () => {
       expect(isOrgOwner(makeMember({ role: 'owner', status: 'blocked' }))).toBe(false)
     })

     test('organizer is NOT owner', () => {
       expect(isOrgOwner(makeMember({ role: 'organizer' }))).toBe(false)
     })

     test('player is NOT owner', () => {
       expect(isOrgOwner(makeMember({ role: 'player' }))).toBe(false)
     })

     test('null is NOT owner', () => {
       expect(isOrgOwner(null)).toBe(false)
     })
   })

   describe('canManageOrganization', () => {
     test('only owner can manage', () => {
       expect(canManageOrganization(makeMember({ role: 'owner' }))).toBe(true)
       expect(canManageOrganization(makeMember({ role: 'organizer' }))).toBe(false)
       expect(canManageOrganization(makeMember({ role: 'player' }))).toBe(false)
       expect(canManageOrganization(null)).toBe(false)
     })
   })

   describe('canInviteToOrg', () => {
     test('Phase 4: only owner can invite', () => {
       expect(canInviteToOrg(makeMember({ role: 'owner' }))).toBe(true)
       expect(canInviteToOrg(makeMember({ role: 'organizer' }))).toBe(false)
       expect(canInviteToOrg(makeMember({ role: 'assistant' }))).toBe(false)
     })
   })

   describe('requireOrgOwner', () => {
     test('owner passes', () => {
       expect(() => requireOrgOwner(makeMember({ role: 'owner' }))).not.toThrow()
     })

     test('player throws ForbiddenError', () => {
       expect(() => requireOrgOwner(makeMember({ role: 'player' }))).toThrow(ForbiddenError)
     })

     test('blocked owner throws', () => {
       expect(() => requireOrgOwner(makeMember({ role: 'owner', status: 'blocked' }))).toThrow(
         ForbiddenError,
       )
     })

     test('error has correct code', () => {
       try {
         requireOrgOwner(makeMember({ role: 'player' }))
       } catch (e) {
         expect((e as ForbiddenError).code).toBe('permission.not_owner')
       }
     })
   })

   describe('requireOrgMember', () => {
     test('active passes', () => {
       expect(() => requireOrgMember(makeMember({ status: 'active' }))).not.toThrow()
     })

     test('pending passes', () => {
       expect(() => requireOrgMember(makeMember({ status: 'pending' }))).not.toThrow()
     })

     test('blocked throws', () => {
       expect(() => requireOrgMember(makeMember({ status: 'blocked' }))).toThrow(ForbiddenError)
     })

     test('left throws', () => {
       expect(() => requireOrgMember(makeMember({ status: 'left' }))).toThrow(ForbiddenError)
     })
   })

   describe('requireOrgActive', () => {
     test('active org passes', () => {
       expect(() => requireOrgActive(makeOrg({ status: 'active' }))).not.toThrow()
     })

     test('archived org throws', () => {
       expect(() => requireOrgActive(makeOrg({ status: 'archived' }))).toThrow(ForbiddenError)
     })

     test('suspended org throws', () => {
       expect(() => requireOrgActive(makeOrg({ status: 'suspended' }))).toThrow(ForbiddenError)
     })

     test('null throws', () => {
       expect(() => requireOrgActive(null)).toThrow(ForbiddenError)
     })

     test('archived returns specific code', () => {
       try {
         requireOrgActive(makeOrg({ status: 'archived' }))
       } catch (e) {
         expect((e as ForbiddenError).code).toBe('permission.org_archived')
       }
     })
   })
   ```

2. **Edge case sanity tests:**

   ```ts
   describe('edge cases', () => {
     test('owner with pending status is NOT owner (data integrity)', () => {
       // Эта ситуация не должна возникать в норме, но защищаемся
       const m = makeMember({ role: 'owner', status: 'pending' })
       expect(isOrgOwner(m)).toBe(false)
       expect(() => requireOrgOwner(m)).toThrow()
     })

     test('all canX functions accept null', () => {
       expect(canManageOrganization(null)).toBe(false)
       expect(canManageMembers(null)).toBe(false)
       expect(canInviteToOrg(null)).toBe(false)
       expect(canViewAuditLog(null)).toBe(false)
       expect(canViewOrgMembers(null)).toBe(false)
     })
   })
   ```

## Критерии приёмки

- ✅ Файл `policies.test.ts` существует со всеми тестами
- ✅ Все 6 main canX функций покрыты тестами
- ✅ Все 5 main requireX функций покрыты тестами
- ✅ Edge cases:
  - blocked, left, rejected — НЕ active member
  - blocked owner — НЕ owner
  - null member — обрабатывается gracefully
  - pending owner — НЕ owner (data integrity)
- ✅ Тесты проверяют `error.code` для каждого requireX
- ✅ Все тесты проходят: `pnpm -F @volley-time/web test`

## Подсказки

- **Helpers `makeMember` / `makeOrg`** — паттерн для краткости. Используй overrides spread для нужных полей.
- **`expect().toThrow(ForbiddenError)`** — проверяет тип ошибки. Для check кода — try/catch + проверка `e.code`.
- **Total тестов:** ~30-40. Должны проходить < 1 сек.

## Не делать

- ❌ Не делать integration tests здесь — это unit
- ❌ Не дублировать тесты из 4.8 (там — full flow)
- ❌ Не покрывать typeof / type tests — TypeScript сам проверяет
