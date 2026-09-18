---
id: '4.2.2'
phase: '4'
epic: '4.2'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '4.2.1'
estimated_hours: '2-3'
tags:
  - service
  - members
  - modulith
---

# Task 4.2.2: MemberService (CRUD + role management)

## Цель

Создать модуль `apps/web/modules/members/` с сервисом для управления участниками: добавление, list, изменение роли/статуса, block/unblock, leave.

## Контекст

`MemberService` используется:

- `OrganizationService.create` — для auto-creation owner member (4.1.2)
- `InviteService.accept` — для добавления нового member через invite (4.4.2)
- API endpoints для admin-операций (4.2.3)

Бизнес-правила:

- Owner не может быть разжалован
- Owner не может leave organization
- Блокировка — это статус `blocked`, не удаление

## Что должно быть сделано

1. **Структура модуля:**

   ```
   apps/web/modules/members/
   ├── service.ts
   ├── repository.ts
   ├── schemas.ts
   ├── errors.ts
   └── index.ts
   ```

2. **`schemas.ts`:**

   ```ts
   import { z } from 'zod'

   export const AddMemberInput = z.object({
     organizationId: z.number().int().positive(),
     userId: z.number().int().positive(),
     role: z.enum(['owner', 'organizer', 'assistant', 'player']).default('player'),
     status: z.enum(['pending', 'active', 'guest']).default('active'),
     invitedByUserId: z.number().int().positive().optional(),
     inviteId: z.number().int().positive().optional(),
   })
   export type AddMemberInput = z.infer<typeof AddMemberInput>

   export const ChangeMemberRoleInput = z.object({
     role: z.enum(['organizer', 'assistant', 'player']), // owner нельзя назначить через UI
   })
   ```

3. **`errors.ts`:**

   ```ts
   export class MemberError extends Error {
     code: string
     constructor(code: string, message: string) {
       super(message)
       this.code = code
       this.name = 'MemberError'
     }
   }

   export class AlreadyMemberError extends MemberError {
     constructor() {
       super('member.already_exists', 'User is already a member of this organization')
     }
   }

   export class MemberNotFoundError extends MemberError {
     constructor(id: number | string) {
       super('member.not_found', `Member ${id} not found`)
     }
   }

   export class CannotBlockOwnerError extends MemberError {
     constructor() {
       super('member.cannot_block_owner', 'Owner cannot be blocked')
     }
   }

   export class CannotDemoteOwnerError extends MemberError {
     constructor() {
       super('member.cannot_demote_owner', 'Owner cannot be demoted; transfer ownership first')
     }
   }

   export class OwnerCannotLeaveError extends MemberError {
     constructor() {
       super(
         'member.owner_cannot_leave',
         'Owner cannot leave; archive organization or transfer ownership',
       )
     }
   }
   ```

4. **`repository.ts`:**

   ```ts
   import type { DB } from '@volley-time/db'
   import {
     organizationMembers,
     organizations,
     type OrganizationMember,
     type NewOrganizationMember,
   } from '@volley-time/db'
   import { eq, and, ne, inArray } from 'drizzle-orm'

   export const memberRepository = {
     async create(db: DB, data: NewOrganizationMember): Promise<OrganizationMember> {
       const [m] = await db.insert(organizationMembers).values(data).returning()
       if (!m) throw new Error('Failed to create member')
       return m
     },

     async getById(db: DB, id: number): Promise<OrganizationMember | null> {
       const m = await db.query.organizationMembers.findFirst({
         where: eq(organizationMembers.id, id),
       })
       return m ?? null
     },

     async getByOrgAndUser(
       db: DB,
       orgId: number,
       userId: number,
     ): Promise<OrganizationMember | null> {
       const m = await db.query.organizationMembers.findFirst({
         where: and(
           eq(organizationMembers.organizationId, orgId),
           eq(organizationMembers.userId, userId),
         ),
       })
       return m ?? null
     },

     async listByOrg(db: DB, orgId: number, statuses?: string[]): Promise<OrganizationMember[]> {
       const where = statuses
         ? and(
             eq(organizationMembers.organizationId, orgId),
             inArray(organizationMembers.status, statuses as any),
           )
         : eq(organizationMembers.organizationId, orgId)
       return db.query.organizationMembers.findMany({
         where,
         with: { user: true },
         orderBy: (m, { asc }) => [asc(m.createdAt)],
       })
     },

     async update(db: DB, id: number, data: Partial<NewOrganizationMember>) {
       const [m] = await db
         .update(organizationMembers)
         .set({ ...data, updatedAt: new Date() })
         .where(eq(organizationMembers.id, id))
         .returning()
       if (!m) throw new Error(`Member ${id} not found`)
       return m
     },
   }
   ```

5. **`service.ts`:**

   ```ts
   import { db as defaultDb } from '@volley-time/db'
   import { memberRepository } from './repository'
   import { AddMemberInput, ChangeMemberRoleInput } from './schemas'
   import {
     AlreadyMemberError,
     MemberNotFoundError,
     CannotBlockOwnerError,
     CannotDemoteOwnerError,
     OwnerCannotLeaveError,
   } from './errors'
   import { organizations, organizationMembers } from '@volley-time/db'
   import { eq, and, ne } from 'drizzle-orm'

   export interface ServiceContext {
     userId: number
     db?: typeof defaultDb
   }

   export const memberService = {
     async addMember(ctx: ServiceContext, input: AddMemberInput) {
       const db = ctx.db ?? defaultDb
       const parsed = AddMemberInput.parse(input)

       // Check duplicate
       const existing = await memberRepository.getByOrgAndUser(
         db,
         parsed.organizationId,
         parsed.userId,
       )
       if (existing && existing.status !== 'left' && existing.status !== 'rejected') {
         throw new AlreadyMemberError()
       }

       if (existing && (existing.status === 'left' || existing.status === 'rejected')) {
         // Reactivate
         return memberRepository.update(db, existing.id, {
           status: parsed.status,
           role: parsed.role,
           joinedAt: new Date(),
           invitedByUserId: parsed.invitedByUserId,
           inviteId: parsed.inviteId,
         })
       }

       return memberRepository.create(db, {
         organizationId: parsed.organizationId,
         userId: parsed.userId,
         role: parsed.role,
         status: parsed.status,
         joinedAt: parsed.status === 'active' ? new Date() : null,
         invitedByUserId: parsed.invitedByUserId,
         inviteId: parsed.inviteId,
       })
     },

     async listByOrg(ctx: ServiceContext, orgId: number, statuses?: string[]) {
       const db = ctx.db ?? defaultDb
       return memberRepository.listByOrg(db, orgId, statuses)
     },

     async listOrgsForUser(ctx: ServiceContext) {
       const db = ctx.db ?? defaultDb
       // Get all orgs where user is active member
       const rows = await db
         .select({ org: organizations, member: organizationMembers })
         .from(organizationMembers)
         .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
         .where(
           and(
             eq(organizationMembers.userId, ctx.userId),
             eq(organizationMembers.status, 'active'),
             ne(organizations.status, 'archived'),
           ),
         )
       return rows.map((r) => r.org)
     },

     async getMember(ctx: ServiceContext, memberId: number) {
       const db = ctx.db ?? defaultDb
       const m = await memberRepository.getById(db, memberId)
       if (!m) throw new MemberNotFoundError(memberId)
       return m
     },

     async changeRole(
       ctx: ServiceContext,
       memberId: number,
       role: 'organizer' | 'assistant' | 'player',
     ) {
       const db = ctx.db ?? defaultDb
       const member = await this.getMember(ctx, memberId)

       if (member.role === 'owner') {
         throw new CannotDemoteOwnerError()
       }

       return memberRepository.update(db, memberId, { role })
     },

     async blockMember(ctx: ServiceContext, memberId: number) {
       const db = ctx.db ?? defaultDb
       const member = await this.getMember(ctx, memberId)

       if (member.role === 'owner') {
         throw new CannotBlockOwnerError()
       }

       return memberRepository.update(db, memberId, { status: 'blocked' })
     },

     async unblockMember(ctx: ServiceContext, memberId: number) {
       const db = ctx.db ?? defaultDb
       const member = await this.getMember(ctx, memberId)
       if (member.status !== 'blocked') return member // idempotent
       return memberRepository.update(db, memberId, { status: 'active' })
     },

     async leaveOrg(ctx: ServiceContext, orgId: number) {
       const db = ctx.db ?? defaultDb
       const member = await memberRepository.getByOrgAndUser(db, orgId, ctx.userId)
       if (!member) throw new MemberNotFoundError(`for org ${orgId} user ${ctx.userId}`)

       if (member.role === 'owner') {
         throw new OwnerCannotLeaveError()
       }

       return memberRepository.update(db, member.id, { status: 'left' })
     },
   }
   ```

6. **`index.ts`:**
   ```ts
   export { memberService } from './service'
   export type { AddMemberInput } from './schemas'
   export {
     MemberError,
     AlreadyMemberError,
     MemberNotFoundError,
     CannotBlockOwnerError,
     CannotDemoteOwnerError,
     OwnerCannotLeaveError,
   } from './errors'
   ```

## Критерии приёмки

- ✅ `addMember` создаёт OrganizationMember
- ✅ Повторный добавление того же user'а → `AlreadyMemberError`
- ✅ Reactivation: если user был `left`/`rejected`, добавление работает (status переходит в новый)
- ✅ `blockMember` для owner → `CannotBlockOwnerError`
- ✅ `changeRole` для owner → `CannotDemoteOwnerError`
- ✅ `leaveOrg` для owner → `OwnerCannotLeaveError`
- ✅ `listOrgsForUser` возвращает только active организации с active membership
- ✅ Unique constraint в БД защищает от race conditions при duplicate insert

## Подсказки

- **Reactivation паттерн:** иначе у нас будут несколько members `(user_id, organization_id)` — нарушение unique constraint. Reactivation — это UPDATE existing с новым status.
- **`joinedAt: null` для pending** — поле заполнится при approve в pending → active.
- **`listOrgsForUser` через JOIN** — Drizzle relational queries (`.findMany({ with: ... })`) тоже работают, но JOIN явнее и быстрее для этого случая.

## Не делать

- ❌ Не делать permissions check здесь — это responsibility 4.3 + middleware
- ❌ Не делать notifications — Phase 8
- ❌ Не делать batch operations (block multiple) — Phase 14+
- ❌ Не делать guest status в Phase 4 — это для events (Phase 5)
