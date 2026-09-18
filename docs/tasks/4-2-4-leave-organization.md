---
id: '4.2.4'
phase: '4'
epic: '4.2'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 4.9.'
roles:
  - BACK
  - QA
depends_on:
  - '4.2.3'
estimated_hours: '1'
tags:
  - service
  - members
  - edge-cases
---

# Task 4.2.4: Leave organization (self) + edge cases

## Цель

Доработать `memberService.leaveOrg` чтобы он был идемпотентен и покрывал edge cases. Добавить integration-тесты для полного flow.

## Контекст

Базовая реализация в 4.2.2. В этой задаче — финализация edge cases и тесты:

- Owner не может leave (OwnerCannotLeaveError)
- Повторный leave идемпотентен
- Left member может rejoin через invite (reactivation)
- Не-member выбрасывает MemberNotFoundError

## Что должно быть сделано

1. **Уточнить `memberService.leaveOrg`** (если ещё не сделано в 4.2.2):

   ```ts
   async leaveOrg(ctx: ServiceContext, orgId: number) {
     const db = ctx.db ?? defaultDb
     const member = await memberRepository.getByOrgAndUser(db, orgId, ctx.userId)
     if (!member) {
       throw new MemberNotFoundError(`for org ${orgId} user ${ctx.userId}`)
     }

     if (member.status === 'left') {
       return member  // idempotent
     }

     if (member.role === 'owner') {
       throw new OwnerCannotLeaveError()
     }

     return memberRepository.update(db, member.id, {
       status: 'left',
       // joinedAt сохраняется — это история
     })
   }
   ```

2. **Integration тест** `apps/web/modules/members/__tests__/leave.integration.test.ts`:
   ```ts
   import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
   import { createTestDb, createTestUser, type TestDb } from '@volley-time/db/test-utils'
   import { organizationService } from '~/modules/organizations'
   import { memberService, OwnerCannotLeaveError, MemberNotFoundError } from '~/modules/members'

   describe('leaveOrg (integration)', () => {
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

     test('player can leave organization', async () => {
       const owner = await createTestUser(testDb.db, { email: 'owner@t.com' })
       const player = await createTestUser(testDb.db, { email: 'player@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Test Org' },
       )
       await memberService.addMember(
         { userId: player.id, db: testDb.db },
         { organizationId: org.id, userId: player.id, role: 'player', status: 'active' },
       )

       const result = await memberService.leaveOrg({ userId: player.id, db: testDb.db }, org.id)
       expect(result.status).toBe('left')
     })

     test('owner cannot leave', async () => {
       const owner = await createTestUser(testDb.db, { email: 'owner@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Test Org' },
       )

       await expect(
         memberService.leaveOrg({ userId: owner.id, db: testDb.db }, org.id),
       ).rejects.toThrow(OwnerCannotLeaveError)
     })

     test('leaving twice is idempotent', async () => {
       const owner = await createTestUser(testDb.db, { email: 'owner@t.com' })
       const player = await createTestUser(testDb.db, { email: 'player@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Test Org' },
       )
       await memberService.addMember(
         { userId: player.id, db: testDb.db },
         { organizationId: org.id, userId: player.id, role: 'player', status: 'active' },
       )

       const first = await memberService.leaveOrg({ userId: player.id, db: testDb.db }, org.id)
       const second = await memberService.leaveOrg({ userId: player.id, db: testDb.db }, org.id)
       expect(first.id).toBe(second.id)
       expect(second.status).toBe('left')
     })

     test('leaving non-member throws', async () => {
       const owner = await createTestUser(testDb.db, { email: 'owner@t.com' })
       const stranger = await createTestUser(testDb.db, { email: 'stranger@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Test Org' },
       )

       await expect(
         memberService.leaveOrg({ userId: stranger.id, db: testDb.db }, org.id),
       ).rejects.toThrow(MemberNotFoundError)
     })

     test('left member can rejoin via re-add', async () => {
       const owner = await createTestUser(testDb.db, { email: 'owner@t.com' })
       const player = await createTestUser(testDb.db, { email: 'player@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Test Org' },
       )
       const original = await memberService.addMember(
         { userId: player.id, db: testDb.db },
         { organizationId: org.id, userId: player.id, role: 'player', status: 'active' },
       )

       await memberService.leaveOrg({ userId: player.id, db: testDb.db }, org.id)

       const rejoined = await memberService.addMember(
         { userId: player.id, db: testDb.db },
         { organizationId: org.id, userId: player.id, role: 'player', status: 'active' },
       )
       expect(rejoined.id).toBe(original.id) // reactivation, не новая запись
       expect(rejoined.status).toBe('active')
     })
   })
   ```

## Критерии приёмки

- ✅ Player может leave (status → `left`)
- ✅ Owner получает `OwnerCannotLeaveError`
- ✅ Повторный leave идемпотентен
- ✅ Leave для non-member → `MemberNotFoundError`
- ✅ Left member может rejoin через addMember (reactivation того же record)
- ✅ `joinedAt` сохраняется при leave (история)
- ✅ Все 5 тестов проходят

## Подсказки

- **Reactivation** работает потому что в `addMember` (4.2.2) есть проверка status `left`/`rejected` и UPDATE существующего record.
- **`joinedAt` not reset:** это важно для аудита — видно, когда человек впервые присоединился.
- **Полная очистка истории при leave** — Phase 14+ (GDPR-like delete).

## Не делать

- ❌ Не отправлять notification owner'у — Phase 8
- ❌ Не делать кастомные reasons для leave — лишнее
- ❌ Не блокировать rejoin — нормальный сценарий
