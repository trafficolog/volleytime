---
id: '4.4.2'
phase: '4'
epic: '4.4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 4.9.'
roles:
  - BACK
depends_on:
  - '4.4.1'
  - '4.2.2'
estimated_hours: '2-3'
tags:
  - service
  - invites
  - modulith
---

# Task 4.4.2: InviteService (create, revoke, preview, accept)

## Цель

Создать модуль `apps/web/modules/invites/` с сервисом для управления invite-ссылками.

## Контекст

Сервис инкапсулирует всю логику invite: генерацию токена, валидацию (revoked/expired/exhausted), атомарное принятие. Используется в API (4.4.3) и боте (4.4.4 — через preview).

## Что должно быть сделано

1. **Установить nanoid:**

   ```bash
   pnpm -F @volley-time/web add nanoid
   ```

2. **Структура:**

   ```
   apps/web/modules/invites/
   ├── service.ts
   ├── repository.ts
   ├── schemas.ts
   ├── errors.ts
   └── index.ts
   ```

3. **`schemas.ts`:**

   ```ts
   import { z } from 'zod'

   export const CreateInviteInput = z.object({
     organizationId: z.number().int().positive(),
     roleToAssign: z.enum(['player', 'organizer', 'assistant']).default('player'),
     defaultMemberStatus: z.enum(['active', 'pending']).optional(), // если нет — берём из org
     maxUses: z.number().int().positive().nullable().optional(),
     expiresInDays: z.number().int().positive().max(365).optional(), // конвертируется в expiresAt
   })
   export type CreateInviteInput = z.infer<typeof CreateInviteInput>
   ```

4. **`errors.ts`:**

   ```ts
   export class InviteError extends Error {
     code: string
     constructor(code: string, message: string) {
       super(message)
       this.code = code
       this.name = 'InviteError'
     }
   }

   export class InviteNotFoundError extends InviteError {
     constructor(token: string) {
       super('invite.not_found', `Invite "${token}" not found`)
     }
   }

   export class InviteRevokedError extends InviteError {
     constructor() {
       super('invite.revoked', 'This invite has been revoked')
     }
   }

   export class InviteExpiredError extends InviteError {
     constructor() {
       super('invite.expired', 'This invite has expired')
     }
   }

   export class InviteUsesExhaustedError extends InviteError {
     constructor() {
       super('invite.uses_exhausted', 'This invite has reached its max uses')
     }
   }

   export class InviteAlreadyUsedByUserError extends InviteError {
     constructor() {
       super('invite.already_used_by_user', 'You are already a member of this organization')
     }
   }
   ```

5. **`repository.ts`:**

   ```ts
   import type { DB } from '@volley-time/db'
   import { inviteLinks, type InviteLink, type NewInviteLink } from '@volley-time/db'
   import { eq, and, sql } from 'drizzle-orm'

   export const inviteRepository = {
     async create(db: DB, data: NewInviteLink): Promise<InviteLink> {
       const [inv] = await db.insert(inviteLinks).values(data).returning()
       if (!inv) throw new Error('Failed to create invite')
       return inv
     },

     async getByToken(db: DB, token: string): Promise<InviteLink | null> {
       const inv = await db.query.inviteLinks.findFirst({
         where: eq(inviteLinks.token, token),
       })
       return inv ?? null
     },

     async listByOrg(db: DB, orgId: number): Promise<InviteLink[]> {
       return db.query.inviteLinks.findMany({
         where: eq(inviteLinks.organizationId, orgId),
         orderBy: (i, { desc }) => [desc(i.createdAt)],
       })
     },

     async revoke(db: DB, id: number): Promise<InviteLink> {
       const [inv] = await db
         .update(inviteLinks)
         .set({ isRevoked: true })
         .where(eq(inviteLinks.id, id))
         .returning()
       if (!inv) throw new Error(`Invite ${id} not found`)
       return inv
     },

     /**
      * Atomically increment usesCount.
      * Returns updated invite if increment succeeded (i.e., maxUses not exceeded).
      * Returns null if maxUses already reached.
      */
     async incrementUses(db: DB, id: number): Promise<InviteLink | null> {
       const [inv] = await db
         .update(inviteLinks)
         .set({ usesCount: sql`${inviteLinks.usesCount} + 1` })
         .where(
           and(
             eq(inviteLinks.id, id),
             sql`(${inviteLinks.maxUses} IS NULL OR ${inviteLinks.usesCount} < ${inviteLinks.maxUses})`,
           ),
         )
         .returning()
       return inv ?? null
     },
   }
   ```

6. **`service.ts`:**

   ```ts
   import { nanoid } from 'nanoid'
   import { db as defaultDb, organizations, organizationMembers } from '@volley-time/db'
   import { eq, and } from 'drizzle-orm'
   import { inviteRepository } from './repository'
   import { CreateInviteInput } from './schemas'
   import {
     InviteNotFoundError,
     InviteRevokedError,
     InviteExpiredError,
     InviteUsesExhaustedError,
     InviteAlreadyUsedByUserError,
   } from './errors'
   import { memberService } from '../members'
   import { organizationService } from '../organizations'

   export interface ServiceContext {
     userId: number
     db?: typeof defaultDb
   }

   const TOKEN_LENGTH = 32

   export const inviteService = {
     async createInvite(ctx: ServiceContext, input: CreateInviteInput) {
       const parsed = CreateInviteInput.parse(input)
       const db = ctx.db ?? defaultDb

       const org = await organizationService.getById(ctx, parsed.organizationId)

       const expiresAt = parsed.expiresInDays
         ? new Date(Date.now() + parsed.expiresInDays * 24 * 60 * 60 * 1000)
         : null

       return inviteRepository.create(db, {
         token: nanoid(TOKEN_LENGTH),
         organizationId: parsed.organizationId,
         type: 'organization_join',
         createdByUserId: ctx.userId,
         roleToAssign: parsed.roleToAssign,
         defaultMemberStatus: parsed.defaultMemberStatus ?? org.defaultMemberStatus,
         maxUses: parsed.maxUses ?? null,
         expiresAt,
       })
     },

     async listByOrg(ctx: ServiceContext, orgId: number) {
       const db = ctx.db ?? defaultDb
       return inviteRepository.listByOrg(db, orgId)
     },

     async revokeInvite(ctx: ServiceContext, inviteId: number) {
       const db = ctx.db ?? defaultDb
       const inv = await db.query.inviteLinks.findFirst({
         where: eq(inviteLinks.id, inviteId),
       })
       if (!inv) throw new InviteNotFoundError(String(inviteId))
       return inviteRepository.revoke(db, inviteId)
     },

     /**
      * Preview invite — no auth required.
      * Returns sanitized invite info (no sensitive data).
      */
     async previewInvite(token: string) {
       const db = defaultDb
       const inv = await inviteRepository.getByToken(db, token)
       if (!inv) throw new InviteNotFoundError(token)

       this.validateInvite(inv)

       const org = await db.query.organizations.findFirst({
         where: eq(organizations.id, inv.organizationId),
       })
       if (!org || org.status === 'archived') {
         throw new InviteNotFoundError(token)
       }

       return {
         token: inv.token,
         organization: {
           id: org.id,
           slug: org.slug,
           name: org.name,
           description: org.description,
           city: org.city,
         },
         roleToAssign: inv.roleToAssign,
         defaultMemberStatus: inv.defaultMemberStatus,
         expiresAt: inv.expiresAt,
         maxUses: inv.maxUses,
         usesCount: inv.usesCount,
       }
     },

     /**
      * Accept invite. Auth required.
      * Atomically:
      *   1. Validate invite
      *   2. Increment usesCount (with race-safe check)
      *   3. Create or reactivate OrganizationMember
      */
     async acceptInvite(ctx: ServiceContext, token: string) {
       const db = ctx.db ?? defaultDb

       return await db.transaction(async (tx) => {
         const inv = await inviteRepository.getByToken(tx, token)
         if (!inv) throw new InviteNotFoundError(token)

         this.validateInvite(inv)

         // Check user already member
         const existingMember = await tx.query.organizationMembers.findFirst({
           where: and(
             eq(organizationMembers.organizationId, inv.organizationId),
             eq(organizationMembers.userId, ctx.userId),
           ),
         })
         if (
           existingMember &&
           existingMember.status !== 'left' &&
           existingMember.status !== 'rejected'
         ) {
           throw new InviteAlreadyUsedByUserError()
         }

         // Race-safe increment
         const incremented = await inviteRepository.incrementUses(tx, inv.id)
         if (!incremented) {
           throw new InviteUsesExhaustedError()
         }

         // Create or reactivate member
         const member = await memberService.addMember(
           { userId: ctx.userId, db: tx },
           {
             organizationId: inv.organizationId,
             userId: ctx.userId,
             role: inv.roleToAssign as 'player' | 'organizer' | 'assistant',
             status: inv.defaultMemberStatus as 'active' | 'pending',
             invitedByUserId: inv.createdByUserId,
             inviteId: inv.id,
           },
         )

         return { invite: incremented, member }
       })
     },

     /**
      * Internal: throws if invite is not usable.
      */
     validateInvite(inv: {
       isRevoked: boolean
       expiresAt: Date | null
       maxUses: number | null
       usesCount: number
     }) {
       if (inv.isRevoked) throw new InviteRevokedError()
       if (inv.expiresAt && inv.expiresAt < new Date()) throw new InviteExpiredError()
       if (inv.maxUses !== null && inv.usesCount >= inv.maxUses) {
         throw new InviteUsesExhaustedError()
       }
     },
   }
   ```

7. **`index.ts`:**
   ```ts
   export { inviteService } from './service'
   export type { CreateInviteInput } from './schemas'
   export {
     InviteError,
     InviteNotFoundError,
     InviteRevokedError,
     InviteExpiredError,
     InviteUsesExhaustedError,
     InviteAlreadyUsedByUserError,
   } from './errors'
   ```

## Критерии приёмки

- ✅ `createInvite` создаёт invite с nanoid token (32 chars)
- ✅ `expiresInDays` конвертируется в `expiresAt`
- ✅ Если `defaultMemberStatus` не указан — берётся из org settings
- ✅ `previewInvite` (no auth) возвращает sanitized данные org + параметры invite
- ✅ `acceptInvite` — атомарная транзакция:
  - Validate invite
  - Race-safe increment usesCount
  - Create or reactivate member
- ✅ Validation throws правильные ошибки:
  - Revoked → InviteRevokedError
  - Expired → InviteExpiredError
  - Max uses reached → InviteUsesExhaustedError
  - User already member → InviteAlreadyUsedByUserError
- ✅ Race condition: 2 user'а одновременно accept invite с `maxUses: 1` — только один успевает, второй получает InviteUsesExhaustedError

## Подсказки

- **Race-safe increment** через `WHERE usesCount < maxUses` в UPDATE — атомарная операция в PostgreSQL. Если условие false, обновление не происходит, возвращается null.
- **Транзакция** обернёт всё: validate → increment → addMember. Если addMember падает (например, уже member), increment роллбекается.
- **Reactivation:** `memberService.addMember` сам обрабатывает status=left/rejected (см. 4.2.2). Просто передаём в него — он реактивирует.

## Не делать

- ❌ Не использовать UUID — nanoid компактнее
- ❌ Не хешировать token — opaque строки
- ❌ Не делать audit logging здесь — wrap'нем в 4.6
- ❌ Не отправлять уведомления — Phase 8
