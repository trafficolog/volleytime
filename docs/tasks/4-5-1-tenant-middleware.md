---
id: '4.5.1'
phase: '4'
epic: '4.5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 4.9.'
roles:
  - BACK
  - SECURITY
depends_on:
  - '4.2.2'
  - '4.3.1'
estimated_hours: '2'
tags:
  - middleware
  - multi-tenancy
  - security
---

# Task 4.5.1: Tenant middleware + интеграция

## Цель

Создать Nuxt server middleware, которое для всех routes `/api/organizations/:orgId/*` автоматически:

1. Парсит `orgId` из URL
2. Проверяет auth (через better-auth session)
3. Загружает Organization, проверяет status (404/410)
4. Загружает OrganizationMember для current user (403 если не member, blocked, left)
5. Прокидывает `org`, `member`, `user` в `event.context`

## Контекст

Сердце multi-tenancy. Без него каждый endpoint дублировал бы проверку членства. Middleware централизует: parse orgId → load org → load member → проверки → наполнение context.

## Что должно быть сделано

1. **`apps/web/server/middleware/tenant.ts`:**

   ```ts
   import { auth } from '@volley-time/auth'
   import { db, organizations, organizationMembers } from '@volley-time/db'
   import { eq, and } from 'drizzle-orm'

   const ORG_URL_PATTERN = /^\/api\/organizations\/(\d+)(\/|$)/

   export default defineEventHandler(async (event) => {
     const url = event.path
     if (!url) return
     const match = url.match(ORG_URL_PATTERN)
     if (!match) return

     const orgId = Number(match[1])
     if (Number.isNaN(orgId) || orgId <= 0) {
       throw createError({ statusCode: 400, statusMessage: 'Invalid orgId' })
     }

     // 1. Auth
     const session = await auth.api.getSession({
       headers: getHeaders(event),
     })
     if (!session?.user) {
       throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
     }
     const user = session.user

     // 2. Load organization
     const org = await db.query.organizations.findFirst({
       where: eq(organizations.id, orgId),
     })
     if (!org) {
       throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
     }
     if (org.status === 'archived') {
       throw createError({
         statusCode: 410,
         statusMessage: 'Organization is archived',
         data: { code: 'organization.archived' },
       })
     }
     if (org.status === 'suspended') {
       throw createError({
         statusCode: 403,
         statusMessage: 'Organization is suspended',
         data: { code: 'organization.suspended' },
       })
     }

     // 3. Load membership
     const member = await db.query.organizationMembers.findFirst({
       where: and(
         eq(organizationMembers.organizationId, orgId),
         eq(organizationMembers.userId, user.id),
       ),
     })
     if (!member) {
       throw createError({
         statusCode: 403,
         statusMessage: 'You are not a member of this organization',
         data: { code: 'permission.not_member' },
       })
     }
     if (member.status === 'left' || member.status === 'rejected') {
       throw createError({
         statusCode: 403,
         statusMessage: 'You are no longer a member',
         data: { code: 'permission.no_longer_member' },
       })
     }
     if (member.status === 'blocked') {
       throw createError({
         statusCode: 403,
         statusMessage: 'You are blocked in this organization',
         data: { code: 'permission.blocked' },
       })
     }

     // 4. Populate context
     event.context.organization = org
     event.context.member = member
     event.context.user = user
   })
   ```

2. **TypeScript типы для `event.context`:**
   Создать `apps/web/server/types/h3.d.ts`:

   ```ts
   import type { Organization, OrganizationMember } from '@volley-time/db'
   import type { User } from 'better-auth'

   declare module 'h3' {
     interface H3EventContext {
       organization?: Organization
       member?: OrganizationMember
       user?: User
     }
   }

   export {}
   ```

3. **Тесты middleware** (`apps/web/server/middleware/__tests__/tenant.integration.test.ts`):

   ```ts
   import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
   import { createTestDb, createTestUser, type TestDb } from '@volley-time/db/test-utils'
   import { organizationService } from '~/modules/organizations'
   import { memberService } from '~/modules/members'

   describe('tenant middleware behaviour (via integration calls)', () => {
     let testDb: TestDb
     let ownerId: number
     let strangerId: number
     let blockedUserId: number
     let orgId: number

     beforeAll(async () => {
       testDb = await createTestDb()
       await testDb.truncate()

       const owner = await createTestUser(testDb.db, { email: 'owner@t.com' })
       const stranger = await createTestUser(testDb.db, { email: 'stranger@t.com' })
       const blocked = await createTestUser(testDb.db, { email: 'blocked@t.com' })
       ownerId = owner.id
       strangerId = stranger.id
       blockedUserId = blocked.id

       const org = await organizationService.create(
         { userId: owner.id, db: testDb.db },
         { name: 'Test Org' },
       )
       orgId = org.id

       const blockedMember = await memberService.addMember(
         { userId: owner.id, db: testDb.db },
         { organizationId: orgId, userId: blocked.id, role: 'player', status: 'active' },
       )
       await memberService.blockMember({ userId: owner.id, db: testDb.db }, blockedMember.id)
     })

     afterAll(async () => {
       await testDb.close()
     })

     // Note: эти тесты требуют запущенный Nuxt для полноценной проверки middleware.
     // Здесь — minimal sanity. Полноценные E2E — Phase 9.
     test('sanity: owner member exists', async () => {
       const member = await testDb.db.query.organizationMembers.findFirst({
         where: (m, { and, eq }) => and(eq(m.organizationId, orgId), eq(m.userId, ownerId)),
       })
       expect(member).toBeDefined()
       expect(member?.role).toBe('owner')
     })

     test('sanity: blocked user has blocked status', async () => {
       const member = await testDb.db.query.organizationMembers.findFirst({
         where: (m, { and, eq }) => and(eq(m.organizationId, orgId), eq(m.userId, blockedUserId)),
       })
       expect(member?.status).toBe('blocked')
     })

     test('sanity: stranger has no membership', async () => {
       const member = await testDb.db.query.organizationMembers.findFirst({
         where: (m, { and, eq }) => and(eq(m.organizationId, orgId), eq(m.userId, strangerId)),
       })
       expect(member).toBeUndefined()
     })
   })
   ```

4. **Manual smoke test (через curl):**
   ```bash
   # Должен вернуть 401
   curl -i http://localhost:3000/api/organizations/1/members

   # После auth — должен вернуть 404 если org не существует
   # 403 если user не член
   # 200 OK для active member
   ```

## Критерии приёмки

- ✅ Middleware применяется автоматически для всех `/api/organizations/:orgId/*` routes
- ✅ Для других routes (например, `/api/auth/*`) — пропускается
- ✅ Без auth → 401
- ✅ org не существует → 404
- ✅ org.status = 'archived' → 410 с code `organization.archived`
- ✅ org.status = 'suspended' → 403
- ✅ user не член → 403 с code `permission.not_member`
- ✅ user is blocked → 403 с code `permission.blocked`
- ✅ user is left/rejected → 403 с code `permission.no_longer_member`
- ✅ Active member → context.org/member/user заполнены, endpoint выполняется
- ✅ TypeScript типы для `event.context.*` правильные

## Подсказки

- **Регулярка `^\/api\/organizations\/(\d+)(\/|$)`** — захватывает orgId как число, требует слэш или конец URL после.
- **Public endpoints под `/api/invites/preview/`, `/api/invites/accept`** — НЕ под `/api/organizations/`, поэтому middleware к ним не применяется. Это корректно.
- **`event.context`** — стандартный механизм h3 для прокидывания данных между middleware и handler.
- **Перформанс:** middleware делает 2 DB-запроса (org + member). На MVP это нормально, < 5 ms. В Phase 14+ можно кешировать в Redis.

## Не делать

- ❌ Не делать middleware для `/api/users/*` или auth — отдельная логика
- ❌ Не делать caching org/member — преждевременная оптимизация
- ❌ Не позволять subdomain resolution — Phase 14+
- ❌ Не allow для archived org с warning — strict 410
