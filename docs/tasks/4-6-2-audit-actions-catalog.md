---
id: '4.6.2'
phase: '4'
epic: '4.6'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
depends_on:
  - '4.6.1'
  - '4.1.2'
  - '4.2.2'
  - '4.4.2'
estimated_hours: '1-2'
tags:
  - audit
  - integration
---

# Task 4.6.2: Каталог actions + интеграция в services

## Цель

Создать константы для всех audit actions Phase 4. Интегрировать вызовы `auditService.log` в API endpoints (не в services — чтобы не дублировать).

## Контекст

Чтобы action-коды не были разбросаны magic-строками по коду, выносим их в каталог-константы. Интеграция — в endpoints (после успешной операции), не в services.

## Что должно быть сделано

1. **`apps/web/modules/audit/actions.ts`** — каталог:

   ```ts
   /**
    * Audit action codes.
    * Format: `<entity>.<verb>` — past tense for completed actions.
    */
   export const AuditActions = {
     // Organization
     ORG_CREATED: 'organization.created',
     ORG_UPDATED: 'organization.updated',
     ORG_ARCHIVED: 'organization.archived',

     // Member
     MEMBER_INVITED: 'member.invited',
     MEMBER_JOINED: 'member.joined',
     MEMBER_LEFT: 'member.left',
     MEMBER_BLOCKED: 'member.blocked',
     MEMBER_UNBLOCKED: 'member.unblocked',
     MEMBER_ROLE_CHANGED: 'member.role_changed',
     MEMBER_KICKED: 'member.kicked',

     // Invite
     INVITE_CREATED: 'invite.created',
     INVITE_REVOKED: 'invite.revoked',
     INVITE_USED: 'invite.used',
   } as const

   export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions]
   ```

2. **Интеграция в endpoints (не в services).**

   Принцип: services делают только бизнес-логику, audit вызывается из endpoint обёртки. Это даёт:
   - Доступ к request meta (ip, user-agent)
   - Не путать service unit-тесты с audit
   - Можно отключить audit для test/dev режима

   Пример для `apps/web/server/api/organizations/index.post.ts`:

   ```ts
   import { auditService, AuditActions } from '~/modules/audit'

   export default safeHandler(async (event) => {
     const user = await requireAuth(event)
     const body = await readBody(event)
     const org = await organizationService.create({ userId: user.id }, body)

     await auditService.log(
       { userId: user.id },
       {
         action: AuditActions.ORG_CREATED,
         entityType: 'organization',
         entityId: org.id,
         organizationId: org.id,
         newValue: { name: org.name, slug: org.slug },
         ipAddress: getRequestIP(event, { xForwardedFor: true }),
         userAgent: getRequestHeader(event, 'user-agent'),
       },
     )

     return { organization: org }
   })
   ```

3. **Интеграция для каждого mutation endpoint** (полный список):

   | Endpoint                                                  | Action                       |
   | --------------------------------------------------------- | ---------------------------- |
   | POST /api/organizations                                   | ORG_CREATED                  |
   | PATCH /api/organizations/:orgId                           | ORG_UPDATED (diff в old/new) |
   | POST /api/organizations/:orgId/archive                    | ORG_ARCHIVED                 |
   | POST /api/organizations/:orgId/invites                    | INVITE_CREATED               |
   | PATCH /api/organizations/:orgId/invites/:id (revoke)      | INVITE_REVOKED               |
   | POST /api/invites/accept                                  | MEMBER_JOINED + INVITE_USED  |
   | PATCH /api/organizations/:orgId/members/:id (role change) | MEMBER_ROLE_CHANGED          |
   | PATCH /api/organizations/:orgId/members/:id (block)       | MEMBER_BLOCKED               |
   | PATCH /api/organizations/:orgId/members/:id (unblock)     | MEMBER_UNBLOCKED             |
   | DELETE /api/organizations/:orgId/members/:id (self-leave) | MEMBER_LEFT                  |
   | DELETE /api/organizations/:orgId/members/:id (kick)       | MEMBER_KICKED                |

4. **Diff helper для UPDATE actions:**

   ```ts
   // apps/web/modules/audit/diff.ts
   /**
    * Diff two objects. Returns { old, new } with only changed fields.
    */
   export function diffObjects<T extends Record<string, any>>(
     before: T,
     after: T,
     ignoreFields: string[] = ['updatedAt'],
   ): { old: Partial<T>; new: Partial<T> } {
     const old: Partial<T> = {}
     const new_: Partial<T> = {}

     const keys = new Set([...Object.keys(before), ...Object.keys(after)])
     for (const key of keys) {
       if (ignoreFields.includes(key)) continue
       if (before[key] !== after[key]) {
         old[key as keyof T] = before[key]
         new_[key as keyof T] = after[key]
       }
     }

     return { old, new: new_ }
   }
   ```

   Использование в PATCH:

   ```ts
   const before = event.context.organization
   const after = await organizationService.updateSettings(ctx, before.id, body)
   const { old, new: newDiff } = diffObjects(before, after)

   await auditService.log(ctx, {
     action: AuditActions.ORG_UPDATED,
     entityType: 'organization',
     entityId: after.id,
     organizationId: after.id,
     oldValue: old,
     newValue: newDiff,
     ipAddress: getRequestIP(event, { xForwardedFor: true }),
   })
   ```

5. **Тест базовой интеграции:**
   ```ts
   // apps/web/modules/audit/__tests__/integration.test.ts
   import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
   import { createTestDb, createTestUser, type TestDb } from '@volley-time/db/test-utils'
   import { auditLog } from '@volley-time/db'
   import { eq } from 'drizzle-orm'
   import { auditService, AuditActions } from '../'

   describe('audit integration', () => {
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

     test('logs an entry', async () => {
       const user = await createTestUser(testDb.db)
       await auditService.log(
         { userId: user.id, db: testDb.db },
         {
           action: AuditActions.ORG_CREATED,
           entityType: 'organization',
           entityId: 1,
           organizationId: 1,
           newValue: { name: 'Test' },
         },
       )
       const entries = await testDb.db.query.auditLog.findMany({
         where: eq(auditLog.userId, user.id),
       })
       expect(entries.length).toBe(1)
       expect(entries[0]?.action).toBe('organization.created')
     })

     test('failure does not throw', async () => {
       // Pass invalid data, expect log to handle gracefully
       const user = await createTestUser(testDb.db)
       await expect(
         auditService.log(
           { userId: user.id, db: testDb.db },
           {
             action: AuditActions.ORG_CREATED,
             entityType: 'organization',
             entityId: 99999, // FK violation if checked, but jsonb doesn't check
             newValue: {},
           },
         ),
       ).resolves.toBeUndefined()
     })
   })
   ```

## Критерии приёмки

- ✅ Каталог `AuditActions` создан с 13 константами Phase 4
- ✅ Все mutation endpoints вызывают `auditService.log` после успешной операции
- ✅ `diffObjects` корректно вычисляет old/new для UPDATE
- ✅ `ipAddress` и `userAgent` корректно извлекаются из request
- ✅ Audit fail не ломает основную операцию (resolves даже при ошибке записи)
- ✅ Записи создаются с правильными action codes
- ✅ Integration test проходит

## Подсказки

- **`getRequestIP(event, { xForwardedFor: true })`** — встроенная утилита h3 для получения real IP за proxy.
- **`safeHandler` обёртка** — wrap'ит endpoint в try/catch. Audit вызов внутри try — если падает service, audit не вызывается. Это правильно: audit'им только успехи.
- **Не логируем GET requests** — решение в phase-card. Только mutations.
- **`ignoreFields: ['updatedAt']`** в diff — иначе каждый update будет показывать timestamp diff (noise).

## Не делать

- ❌ Не логировать read operations
- ❌ Не делать audit для каждого тика (e.g. session refresh) — только significant events
- ❌ Не позволять отмену audit (rollback) — append-only
- ❌ Не делать audit в service слое — endpoints более context-aware (IP, headers)
