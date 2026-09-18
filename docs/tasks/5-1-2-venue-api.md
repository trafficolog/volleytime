---
id: '5.1.2'
phase: '5'
epic: '5.1'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '5.1.1'
  - '4.5.1'
estimated_hours: '1'
tags:
  - api
  - venues
  - nuxt
---

# Task 5.1.2: Venue API endpoints + permissions

## Цель

REST endpoints для venues под `/api/organizations/:orgId/venues`. Только owner/organizer создают/редактируют.

## Контекст

Тонкие обёртки над venueService. Tenant middleware (4.5.1) уже наполнил context. Permission: создание/изменение — owner/organizer; чтение — любой active member.

## Что должно быть сделано

1. **Расширить permissions (`modules/permissions/policies.ts`)** — добавить роль organizer для управления контентом:

   ```ts
   export function canManageContent(member: OrganizationMember | null): boolean {
     // owner или organizer могут управлять venues, events, plans
     if (!member || member.status !== 'active') return false
     return member.role === 'owner' || member.role === 'organizer'
   }

   export function requireCanManageContent(member: OrganizationMember | null): void {
     if (!canManageContent(member)) {
       throw new ForbiddenError(
         'permission.cannot_manage_content',
         'Only owner or organizer can manage content',
       )
     }
   }
   ```

   Экспортировать из index. Добавить code в handle-errors: `'permission.cannot_manage_content': 403`.

2. **`server/api/organizations/[orgId]/venues/index.get.ts`:**

   ```ts
   import { venueService } from '~/modules/venues'
   import { requireOrgMember } from '~/modules/permissions'
   import { createServiceContextFromEvent } from '~/modules/shared/context'

   export default defineEventHandler(async (event) => {
     requireOrgMember(event.context.member)
     const ctx = createServiceContextFromEvent(event)
     const venues = await venueService.list(ctx, event.context.organization!.id)
     return { venues }
   })
   ```

3. **`venues/index.post.ts`:**

   ```ts
   import { venueService } from '~/modules/venues'
   import { requireCanManageContent } from '~/modules/permissions'
   import { createServiceContextFromEvent } from '~/modules/shared/context'
   import { handleServiceError } from '~/server/utils/handle-errors'

   export default defineEventHandler(async (event) => {
     try {
       requireCanManageContent(event.context.member)
       const ctx = createServiceContextFromEvent(event)
       const body = await readBody(event)
       const venue = await venueService.create(ctx, event.context.organization!.id, body)
       return { venue }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

4. **`venues/[venueId]/index.get.ts`, `.patch.ts`, `.delete.ts`:**
   - GET: requireOrgMember, вернуть venue (проверить org ownership)
   - PATCH: requireCanManageContent, update
   - DELETE: requireCanManageContent, archive
   - Все проверяют `venue.organizationId === context.organization.id` (cross-org защита) → 404 иначе

5. **Расширить handle-errors** — добавить VenueError:
   ```ts
   if (e instanceof VenueError) {
     throw createError({
       statusCode: codeToStatus[e.code] ?? 400,
       statusMessage: e.message,
       data: { code: e.code },
     })
   }
   const codeToStatus = { ...existing, 'venue.not_found': 404 }
   ```

## Критерии приёмки

- ✅ GET venues — любой active member
- ✅ POST/PATCH/DELETE venues — только owner/organizer (403 для player)
- ✅ Cross-org: venue из другой org → 404
- ✅ DELETE = archive (soft)
- ✅ Ошибки маппятся корректно
- ✅ Tenant middleware применяется (под /api/organizations/:orgId/)

## Подсказки

- **canManageContent** будет переиспользоваться для events (5.2) и plans (5.4) — поэтому отдельная функция, не дублируем owner/organizer проверку.
- **Cross-org проверка обязательна** — venueId в URL может быть из чужой org.

## Не делать

- ❌ Не делать pagination (venues обычно < 10)
- ❌ Не делать UI — эпики 5.9-5.11
