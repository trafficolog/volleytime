---
id: '4.8.2'
phase: '4'
epic: '4.8'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - QA
  - SECURITY
depends_on:
  - '4.5.1'
  - '4.3.1'
estimated_hours: '1-2'
tags:
  - tests
  - security
  - multi-tenancy
---

# Task 4.8.2: Security tests (cross-org access denied)

## Цель

Тесты, которые проверяют изоляцию tenant'ов: user из org A не может видеть/менять данные org B. Это критично для multi-tenancy.

## Контекст

Multi-tenancy дыры — самый опасный класс багов в SaaS. Эти тесты — защита от регрессий.

## Что должно быть сделано

1. **`apps/web/modules/__tests__/cross-org-security.integration.test.ts`:**

   ```ts
   import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
   import { createTestDb, createTestUser, type TestDb } from '@volley-time/db/test-utils'
   import { organizationService } from '~/modules/organizations'
   import { memberService } from '~/modules/members'
   import { inviteService } from '~/modules/invites'

   describe('cross-org security (integration)', () => {
     let testDb: TestDb
     let userA: any, userB: any
     let orgA: any, orgB: any

     beforeAll(async () => {
       testDb = await createTestDb()
     })
     afterAll(async () => {
       await testDb.close()
     })

     beforeEach(async () => {
       await testDb.truncate()
       userA = await createTestUser(testDb.db, { email: 'a@t.com' })
       userB = await createTestUser(testDb.db, { email: 'b@t.com' })
       orgA = await organizationService.create(
         { userId: userA.id, db: testDb.db },
         { name: 'Org A' },
       )
       orgB = await organizationService.create(
         { userId: userB.id, db: testDb.db },
         { name: 'Org B' },
       )
     })

     test('userA is NOT a member of orgB', async () => {
       const member = await testDb.db.query.organizationMembers.findFirst({
         where: (m, { and, eq }) => and(eq(m.organizationId, orgB.id), eq(m.userId, userA.id)),
       })
       expect(member).toBeUndefined()
     })

     test('listOrgsForUser returns only own orgs', async () => {
       const aOrgs = await memberService.listOrgsForUser({ userId: userA.id, db: testDb.db })
       expect(aOrgs.length).toBe(1)
       expect(aOrgs[0]?.id).toBe(orgA.id)

       const bOrgs = await memberService.listOrgsForUser({ userId: userB.id, db: testDb.db })
       expect(bOrgs.length).toBe(1)
       expect(bOrgs[0]?.id).toBe(orgB.id)
     })

     test('invite from orgA does not grant orgB access', async () => {
       const inviteA = await inviteService.createInvite(
         { userId: userA.id, db: testDb.db },
         { organizationId: orgA.id, maxUses: 10 },
       )
       // userB accepts invite to orgA
       await inviteService.acceptInvite({ userId: userB.id, db: testDb.db }, inviteA.token)

       // userB теперь в orgA, но это не даёт прав в orgB как обычному игроку
       const bInA = await testDb.db.query.organizationMembers.findFirst({
         where: (m, { and, eq }) => and(eq(m.organizationId, orgA.id), eq(m.userId, userB.id)),
       })
       expect(bInA?.role).toBe('player') // не owner!

       // userB всё ещё owner ТОЛЬКО в orgB
       const bInB = await testDb.db.query.organizationMembers.findFirst({
         where: (m, { and, eq }) => and(eq(m.organizationId, orgB.id), eq(m.userId, userB.id)),
       })
       expect(bInB?.role).toBe('owner')
     })

     test('members of orgA are not visible when listing orgB', async () => {
       // Add userA-side player
       const playerA = await createTestUser(testDb.db, { email: 'pa@t.com' })
       await memberService.addMember(
         { userId: userA.id, db: testDb.db },
         { organizationId: orgA.id, userId: playerA.id, role: 'player', status: 'active' },
       )

       const orgBMembers = await memberService.listByOrg(
         { userId: userB.id, db: testDb.db },
         orgB.id,
       )
       const memberUserIds = orgBMembers.map((m) => m.userId)
       expect(memberUserIds).not.toContain(playerA.id)
       expect(memberUserIds).not.toContain(userA.id)
       expect(memberUserIds).toContain(userB.id) // only orgB owner
     })

     test('invite preview does not leak across orgs', async () => {
       const inviteB = await inviteService.createInvite(
         { userId: userB.id, db: testDb.db },
         { organizationId: orgB.id },
       )
       const preview = await inviteService.previewInvite(inviteB.token)
       expect(preview.organization.id).toBe(orgB.id)
       expect(preview.organization.name).toBe('Org B')
     })
   })
   ```

2. **Тест на permission-уровне** (опираясь на 4.3.1 функции):

   ```ts
   import { requireOrgOwner, ForbiddenError } from '~/modules/permissions'

   describe('permission enforcement', () => {
     test('non-owner member cannot pass requireOrgOwner', () => {
       const playerMember = {
         role: 'player',
         status: 'active',
         /* ... остальные поля */
       } as any
       expect(() => requireOrgOwner(playerMember)).toThrow(ForbiddenError)
     })
   })
   ```

3. **Документировать каждый тест как security invariant:**
   В комментариях к тестам указать, какую угрозу они закрывают:
   ```ts
   // SECURITY INVARIANT: tenant isolation
   // Threat: user enumerates org IDs, tries to read members of orgs they don't belong to
   // Defense: listByOrg only returns members when caller passes through tenant middleware (4.5.1)
   ```

## Критерии приёмки

- ✅ userA не член orgB (базовая изоляция)
- ✅ listOrgsForUser возвращает только свои org
- ✅ Invite в orgA не даёт прав в orgB
- ✅ Member orgA через invite получает role=player (не owner)
- ✅ Members orgA не видны при листинге orgB
- ✅ Invite preview не утекает данные между org
- ✅ requireOrgOwner блокирует non-owner
- ✅ Каждый тест документирован как security invariant
- ✅ Все тесты проходят

## Подсказки

- **Эти тесты — регрессионная защита.** При любом рефакторинге они должны оставаться зелёными. Если красные — значит дыра в изоляции.
- **Note про HTTP-level isolation:** на уровне service мы передаём правильный orgId. Реальная защита от подмены orgId в URL — tenant middleware (4.5.1). Полноценный тест middleware — требует запущенного Nuxt (Phase 9 E2E). Здесь — service-level invariants.
- **Threat modeling:** для каждого теста думай «что если атакующий...». Это помогает найти пропущенные кейсы.

## Не делать

- ❌ Не пропускать ни один из этих тестов даже если кажутся «очевидными»
- ❌ Не делать penetration testing — Phase 10+ (перед public launch)
- ❌ Не тестировать SQL injection (Drizzle параметризует запросы) — но не строить raw SQL из user input!
