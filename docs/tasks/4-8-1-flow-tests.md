---
id: '4.8.1'
phase: '4'
epic: '4.8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 4.9.'
roles:
  - QA
  - BACK
depends_on:
  - '4.4.2'
  - '4.2.2'
  - '4.1.2'
estimated_hours: '2'
tags:
  - tests
  - integration
  - flows
---

# Task 4.8.1: Integration tests основных flow

## Цель

Integration-тесты для главных Phase 4 flow: создание org, полный invite flow, block, leave.

## Контекст

Integration-тесты главных happy-path flow. Решение 13 в phase-card: B (smoke + flows) + security-critical. Эти тесты — фундамент регрессионной защиты для Phase 5+.

## Что должно быть сделано

1. **`apps/web/modules/__tests__/org-lifecycle.integration.test.ts`:**

   ```ts
   import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
   import { createTestDb, createTestUser, type TestDb } from '@volley-time/db/test-utils'
   import { organizationService } from '~/modules/organizations'
   import { memberService } from '~/modules/members'

   describe('organization lifecycle (integration)', () => {
     let testDb: TestDb

     beforeAll(async () => {
       testDb = await createTestDb()
     })
     afterAll(async () => {
       await testDb.close()
     })
     beforeEach(async () => {
       await testDb.truncate()
     })

     test('create org auto-creates owner member', async () => {
       const owner = await createTestUser(testDb.db, { email: 'o@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Volley Club' },
       )
       expect(org.id).toBeGreaterThan(0)
       expect(org.ownerUserId).toBe(owner.id)
       expect(org.slug).toBe('volley-club')

       const members = await memberService.listByOrg({ userId: owner.id, db: testDb.db }, org.id)
       expect(members.length).toBe(1)
       expect(members[0]?.role).toBe('owner')
       expect(members[0]?.status).toBe('active')
     })

     test('listForUser returns active orgs only', async () => {
       const owner = await createTestUser(testDb.db, { email: 'o@t.com' })
       const org1 = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Org One' },
       )
       const org2 = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Org Two' },
       )
       await organizationService.archive({ userId: owner.id, db: testDb.db }, org2.id)

       const orgs = await memberService.listOrgsForUser({ userId: owner.id, db: testDb.db })
       expect(orgs.length).toBe(1)
       expect(orgs[0]?.id).toBe(org1.id)
     })

     test('slug collision adds suffix', async () => {
       const owner = await createTestUser(testDb.db, { email: 'o@t.com' })
       const org1 = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Same Name' },
       )
       const org2 = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Same Name' },
       )
       expect(org1.slug).toBe('same-name')
       expect(org2.slug).toBe('same-name-2')
     })

     test('archive is idempotent', async () => {
       const owner = await createTestUser(testDb.db, { email: 'o@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Test' },
       )
       const a1 = await organizationService.archive({ userId: owner.id, db: testDb.db }, org.id)
       const a2 = await organizationService.archive({ userId: owner.id, db: testDb.db }, org.id)
       expect(a1.status).toBe('archived')
       expect(a2.status).toBe('archived')
     })
   })
   ```

2. **`apps/web/modules/__tests__/invite-flow.integration.test.ts`:**

   ```ts
   import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
   import { createTestDb, createTestUser, type TestDb } from '@volley-time/db/test-utils'
   import { organizationService } from '~/modules/organizations'
   import {
     inviteService,
     InviteRevokedError,
     InviteUsesExhaustedError,
     InviteAlreadyUsedByUserError,
   } from '~/modules/invites'
   import { memberService } from '~/modules/members'

   describe('invite flow (integration)', () => {
     let testDb: TestDb

     beforeAll(async () => {
       testDb = await createTestDb()
     })
     afterAll(async () => {
       await testDb.close()
     })
     beforeEach(async () => {
       await testDb.truncate()
     })

     async function setup(memberStatus: 'active' | 'pending' = 'active') {
       const owner = await createTestUser(testDb.db, { email: 'owner@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Test Org', defaultMemberStatus: memberStatus },
       )
       return { owner, org }
     }

     test('full flow: create -> preview -> accept -> member created', async () => {
       const { owner, org } = await setup('active')
       const player = await createTestUser(testDb.db, { email: 'player@t.com' })

       const invite = await inviteService.createInvite(
         { userId: owner.id, db: testDb.db },
         { organizationId: org.id, maxUses: 10 },
       )
       expect(invite.token).toBeTruthy()

       const result = await inviteService.acceptInvite(
         { userId: player.id, db: testDb.db },
         invite.token,
       )
       expect(result.member.status).toBe('active')
       expect(result.member.userId).toBe(player.id)
       expect(result.invite.usesCount).toBe(1)
     })

     test('pending org: accepted member is pending', async () => {
       const { owner, org } = await setup('pending')
       const player = await createTestUser(testDb.db, { email: 'player@t.com' })

       const invite = await inviteService.createInvite(
         { userId: owner.id, db: testDb.db },
         { organizationId: org.id },
       )
       const result = await inviteService.acceptInvite(
         { userId: player.id, db: testDb.db },
         invite.token,
       )
       expect(result.member.status).toBe('pending')
     })

     test('revoked invite cannot be accepted', async () => {
       const { owner, org } = await setup()
       const player = await createTestUser(testDb.db, { email: 'player@t.com' })
       const invite = await inviteService.createInvite(
         { userId: owner.id, db: testDb.db },
         { organizationId: org.id },
       )
       await inviteService.revokeInvite({ userId: owner.id, db: testDb.db }, invite.id)

       await expect(
         inviteService.acceptInvite({ userId: player.id, db: testDb.db }, invite.token),
       ).rejects.toThrow(InviteRevokedError)
     })

     test('already member cannot re-accept', async () => {
       const { owner, org } = await setup()
       const player = await createTestUser(testDb.db, { email: 'player@t.com' })
       const invite = await inviteService.createInvite(
         { userId: owner.id, db: testDb.db },
         { organizationId: org.id, maxUses: 10 },
       )

       await inviteService.acceptInvite({ userId: player.id, db: testDb.db }, invite.token)
       await expect(
         inviteService.acceptInvite({ userId: player.id, db: testDb.db }, invite.token),
       ).rejects.toThrow(InviteAlreadyUsedByUserError)
     })

     test('left member can rejoin via invite', async () => {
       const { owner, org } = await setup()
       const player = await createTestUser(testDb.db, { email: 'player@t.com' })
       const invite = await inviteService.createInvite(
         { userId: owner.id, db: testDb.db },
         { organizationId: org.id, maxUses: 10 },
       )

       const first = await inviteService.acceptInvite(
         { userId: player.id, db: testDb.db },
         invite.token,
       )
       await memberService.leaveOrg({ userId: player.id, db: testDb.db }, org.id)

       const rejoin = await inviteService.acceptInvite(
         { userId: player.id, db: testDb.db },
         invite.token,
       )
       expect(rejoin.member.id).toBe(first.member.id) // reactivation
       expect(rejoin.member.status).toBe('active')
     })
   })
   ```

3. **`apps/web/modules/__tests__/member-management.integration.test.ts`:**
   ```ts
   import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
   import { createTestDb, createTestUser, type TestDb } from '@volley-time/db/test-utils'
   import { organizationService } from '~/modules/organizations'
   import { memberService, CannotBlockOwnerError } from '~/modules/members'

   describe('member management (integration)', () => {
     let testDb: TestDb

     beforeAll(async () => {
       testDb = await createTestDb()
     })
     afterAll(async () => {
       await testDb.close()
     })
     beforeEach(async () => {
       await testDb.truncate()
     })

     test('block then unblock member', async () => {
       const owner = await createTestUser(testDb.db, { email: 'o@t.com' })
       const player = await createTestUser(testDb.db, { email: 'p@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'T' },
       )
       const m = await memberService.addMember(
         { userId: owner.id, db: testDb.db },
         { organizationId: org.id, userId: player.id, role: 'player', status: 'active' },
       )

       const blocked = await memberService.blockMember({ userId: owner.id, db: testDb.db }, m.id)
       expect(blocked.status).toBe('blocked')

       const unblocked = await memberService.unblockMember(
         { userId: owner.id, db: testDb.db },
         m.id,
       )
       expect(unblocked.status).toBe('active')
     })

     test('cannot block owner', async () => {
       const owner = await createTestUser(testDb.db, { email: 'o@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'T' },
       )
       const members = await memberService.listByOrg({ userId: owner.id, db: testDb.db }, org.id)
       const ownerMember = members[0]!

       await expect(
         memberService.blockMember({ userId: owner.id, db: testDb.db }, ownerMember.id),
       ).rejects.toThrow(CannotBlockOwnerError)
     })

     test('change role player -> organizer', async () => {
       const owner = await createTestUser(testDb.db, { email: 'o@t.com' })
       const player = await createTestUser(testDb.db, { email: 'p@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'T' },
       )
       const m = await memberService.addMember(
         { userId: owner.id, db: testDb.db },
         { organizationId: org.id, userId: player.id, role: 'player', status: 'active' },
       )

       const updated = await memberService.changeRole(
         { userId: owner.id, db: testDb.db },
         m.id,
         'organizer',
       )
       expect(updated.role).toBe('organizer')
     })
   })
   ```

## Критерии приёмки

- ✅ org-lifecycle: create auto-owner, listForUser filters archived, slug collision, idempotent archive
- ✅ invite-flow: full happy path, pending org, revoked, already member, rejoin
- ✅ member-management: block/unblock, cannot block owner, change role
- ✅ Все тесты используют реальную тестовую БД (через createTestDb)
- ✅ Каждый тест изолирован (truncate в beforeEach)
- ✅ Total ~15 тестов, проходят за < 30 сек

## Подсказки

- **`db: testDb.db`** прокидывается в ServiceContext — все операции идут в тестовую БД.
- **truncate в beforeEach** — каждый тест с чистого листа.
- **Не тестируй HTTP здесь** — это unit/integration на уровне service. HTTP layer — Phase 9 E2E.

## Не делать

- ❌ Не делать E2E через HTTP — Phase 9
- ❌ Не дублировать permission unit-тесты (4.3.3)
- ❌ Не дублировать leave-тесты (4.2.4) — здесь только основные flow
