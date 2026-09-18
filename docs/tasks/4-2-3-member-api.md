---
id: '4.2.3'
phase: '4'
epic: '4.2'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '4.2.2'
  - '4.5.1'
estimated_hours: '1-2'
tags:
  - api
  - members
  - nuxt
---

# Task 4.2.3: API endpoints для members

## Цель

Создать Nuxt server routes для управления членами организации: list, get, изменение role/status, leave/kick.

## Контекст

Все endpoints под `/api/organizations/:orgId/members/*` — используют tenant middleware (4.5.1), который наполняет `event.context` с org/member/user.

Permission checks выполняются через функции из `permissions/` (4.3). В этой задаче — только обёртки.

## Что должно быть сделано

1. **`apps/web/server/api/organizations/[orgId]/members/index.get.ts`** — список members:

   ```ts
   import { memberService } from '~/modules/members'
   import { requireOrgMember } from '~/modules/permissions'

   export default defineEventHandler(async (event) => {
     requireOrgMember(event.context.member)

     const query = getQuery(event)
     const statuses = query.statuses ? String(query.statuses).split(',') : ['active', 'pending']

     const members = await memberService.listByOrg(
       { userId: event.context.user.id },
       event.context.organization.id,
       statuses,
     )

     return { members }
   })
   ```

2. **`apps/web/server/api/organizations/[orgId]/members/[memberId]/index.get.ts`** — карточка:

   ```ts
   import { memberService } from '~/modules/members'
   import { handleServiceError } from '~/server/utils/handle-errors'

   export default defineEventHandler(async (event) => {
     const memberId = Number(getRouterParam(event, 'memberId'))
     try {
       const member = await memberService.getMember({ userId: event.context.user.id }, memberId)

       // Security: member must belong to current org
       if (member.organizationId !== event.context.organization.id) {
         throw createError({ statusCode: 404, statusMessage: 'Member not found' })
       }

       return { member }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

3. **`apps/web/server/api/organizations/[orgId]/members/[memberId]/index.patch.ts`** — изменить role/status:

   ```ts
   import { z } from 'zod'
   import { memberService } from '~/modules/members'
   import { requireOrgOwner } from '~/modules/permissions'
   import { handleServiceError } from '~/server/utils/handle-errors'

   const UpdateMemberInput = z.object({
     role: z.enum(['organizer', 'assistant', 'player']).optional(),
     status: z.enum(['active', 'blocked']).optional(),
   })

   export default defineEventHandler(async (event) => {
     requireOrgOwner(event.context.member)

     const memberId = Number(getRouterParam(event, 'memberId'))
     const body = await readBody(event)

     try {
       const parsed = UpdateMemberInput.parse(body)
       let updated = await memberService.getMember({ userId: event.context.user.id }, memberId)

       if (updated.organizationId !== event.context.organization.id) {
         throw createError({ statusCode: 404, statusMessage: 'Member not found' })
       }

       // Owner не может изменять себя
       if (updated.userId === event.context.user.id) {
         throw createError({
           statusCode: 400,
           statusMessage: 'Cannot modify your own membership',
         })
       }

       if (parsed.role) {
         updated = await memberService.changeRole(
           { userId: event.context.user.id },
           memberId,
           parsed.role,
         )
       }

       if (parsed.status === 'blocked') {
         updated = await memberService.blockMember({ userId: event.context.user.id }, memberId)
       } else if (parsed.status === 'active') {
         updated = await memberService.unblockMember({ userId: event.context.user.id }, memberId)
       }

       return { member: updated }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

4. **`apps/web/server/api/organizations/[orgId]/members/[memberId]/index.delete.ts`** — leave (self) или kick (owner):

   ```ts
   import { memberService } from '~/modules/members'
   import { handleServiceError } from '~/server/utils/handle-errors'

   export default defineEventHandler(async (event) => {
     const memberId = Number(getRouterParam(event, 'memberId'))
     const myMember = event.context.member

     try {
       const member = await memberService.getMember({ userId: event.context.user.id }, memberId)

       if (member.organizationId !== event.context.organization.id) {
         throw createError({ statusCode: 404, statusMessage: 'Member not found' })
       }

       const isSelf = member.userId === event.context.user.id
       const isOwner = myMember.role === 'owner'

       if (!isSelf && !isOwner) {
         throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
       }

       if (isSelf) {
         const updated = await memberService.leaveOrg(
           { userId: event.context.user.id },
           event.context.organization.id,
         )
         return { member: updated }
       } else {
         // Owner kicks → block
         const updated = await memberService.blockMember(
           { userId: event.context.user.id },
           memberId,
         )
         return { member: updated }
       }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

5. **Расширить `handleServiceError` в `apps/web/server/utils/handle-errors.ts`:**
   ```ts
   import {
     MemberError,
     AlreadyMemberError,
     MemberNotFoundError,
     CannotBlockOwnerError,
     CannotDemoteOwnerError,
     OwnerCannotLeaveError,
   } from '~/modules/members'
   // ... existing imports

   const codeToStatus: Record<string, number> = {
     'organization.not_found': 404,
     'organization.archived': 410,
     'organization.slug_taken': 409,
     'member.already_exists': 409,
     'member.not_found': 404,
     'member.cannot_block_owner': 400,
     'member.cannot_demote_owner': 400,
     'member.owner_cannot_leave': 400,
   }

   export function handleServiceError(e: unknown): never {
     if (e instanceof ZodError) {
       throw createError({
         statusCode: 422,
         statusMessage: 'Validation error',
         data: { errors: e.errors },
       })
     }
     if (e instanceof OrganizationError || e instanceof MemberError) {
       throw createError({
         statusCode: codeToStatus[e.code] ?? 400,
         statusMessage: e.message,
         data: { code: e.code },
       })
     }
     throw e
   }
   ```

## Критерии приёмки

- ✅ `GET /api/organizations/:orgId/members` — список member's (фильтр по статусу через query)
- ✅ `GET /.../members/:memberId` — карточка. 404 если member не из этой org
- ✅ `PATCH /.../members/:memberId` — только owner. Не позволяет owner изменять себя (400)
- ✅ `DELETE /.../members/:memberId` — self-leave или kick (owner)
- ✅ Owner не может разжаловать себя через PATCH (400)
- ✅ Demote owner → 400 с code `member.cannot_demote_owner`
- ✅ Block owner → 400 с code `member.cannot_block_owner`
- ✅ Все ошибки маппятся в правильные HTTP статусы через `handleServiceError`

## Подсказки

- **Cross-org security:** проверка `member.organizationId !== context.organization.id` — критична. Без неё атакующий может подменить memberId в URL и читать чужих.
- **PATCH с двумя полями:** если оба `role` и `status` переданы, применяем последовательно.
- **Kick = block в MVP.** Полноценный «remove from org» с очисткой данных — Phase 14+.

## Не делать

- ❌ Не делать PUT (full replace) — только PATCH
- ❌ Не делать bulk operations — Phase 14+
- ❌ Не делать audit log здесь — это responsibility 4.6
- ❌ Не отправлять notifications — Phase 8
