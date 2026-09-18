---
id: '4.4.3'
phase: '4'
epic: '4.4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 4.9.'
roles:
  - BACK
depends_on:
  - '4.4.2'
  - '4.5.1'
estimated_hours: '2'
tags:
  - api
  - invites
  - nuxt
---

# Task 4.4.3: API endpoints для invites (с public preview)

## Цель

Создать Nuxt server routes для CRUD invites + 2 public endpoints (preview без auth, accept с auth).

## Контекст

API-обёртки над inviteService. Особенность: два endpoint (preview, accept) — публичные, не под `/api/organizations/`, поэтому tenant middleware к ним не применяется.

## Что должно быть сделано

1. **`apps/web/server/api/organizations/[orgId]/invites/index.post.ts`** — создать invite:

   ```ts
   import { inviteService } from '~/modules/invites'
   import { requireCanInvite } from '~/modules/permissions'
   import { handleServiceError } from '~/server/utils/handle-errors'

   export default defineEventHandler(async (event) => {
     try {
       requireCanInvite(event.context.member)
       const body = await readBody(event)
       const invite = await inviteService.createInvite(
         { userId: event.context.user.id },
         { ...body, organizationId: event.context.organization.id },
       )

       const botUsername = useRuntimeConfig().public.telegramBotUsername
       const deeplinkUrl = `https://t.me/${botUsername}?start=org_${invite.token}`

       return { invite, deeplinkUrl }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

2. **`apps/web/server/api/organizations/[orgId]/invites/index.get.ts`** — список:

   ```ts
   export default defineEventHandler(async (event) => {
     try {
       requireCanInvite(event.context.member) // только те кто могут создавать видят список
       const invites = await inviteService.listByOrg(
         { userId: event.context.user.id },
         event.context.organization.id,
       )

       const botUsername = useRuntimeConfig().public.telegramBotUsername
       const enriched = invites.map((inv) => ({
         ...inv,
         deeplinkUrl: `https://t.me/${botUsername}?start=org_${inv.token}`,
       }))

       return { invites: enriched }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

3. **`apps/web/server/api/organizations/[orgId]/invites/[inviteId]/index.patch.ts`** — revoke:

   ```ts
   import { z } from 'zod'

   const RevokeInput = z.object({
     isRevoked: z.literal(true),
   })

   export default defineEventHandler(async (event) => {
     try {
       requireCanInvite(event.context.member)
       const inviteId = Number(getRouterParam(event, 'inviteId'))
       const body = await readBody(event)
       RevokeInput.parse(body) // только revoke в Phase 4

       // Проверка что invite принадлежит этой org
       const inv = await db.query.inviteLinks.findFirst({
         where: eq(inviteLinks.id, inviteId),
       })
       if (!inv || inv.organizationId !== event.context.organization.id) {
         throw createError({ statusCode: 404, statusMessage: 'Invite not found' })
       }

       const revoked = await inviteService.revokeInvite({ userId: event.context.user.id }, inviteId)
       return { invite: revoked }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

4. **`apps/web/server/api/invites/preview/[token].get.ts`** — PUBLIC preview:

   ```ts
   // ВНИМАНИЕ: этот endpoint НЕ требует auth и НЕ под /organizations/ (tenant middleware не применяется)
   import { inviteService } from '~/modules/invites'
   import { handleServiceError } from '~/server/utils/handle-errors'

   export default defineEventHandler(async (event) => {
     try {
       const token = getRouterParam(event, 'token')
       if (!token) throw createError({ statusCode: 400, statusMessage: 'Token required' })

       const preview = await inviteService.previewInvite(token)
       return { preview }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

5. **`apps/web/server/api/invites/accept.post.ts`** — auth required:

   ```ts
   import { z } from 'zod'
   import { inviteService } from '~/modules/invites'
   import { requireAuth } from '~/server/utils/auth'
   import { handleServiceError } from '~/server/utils/handle-errors'

   const AcceptInput = z.object({
     token: z.string().min(1),
   })

   export default defineEventHandler(async (event) => {
     try {
       const user = await requireAuth(event)
       const body = await readBody(event)
       const { token } = AcceptInput.parse(body)
       const result = await inviteService.acceptInvite({ userId: user.id }, token)
       return { invite: result.invite, member: result.member }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

6. **Расширить `handleServiceError`** — добавить invite errors:
   ```ts
   import { InviteError } from '~/modules/invites'

   const codeToStatus: Record<string, number> = {
     // ... existing
     'invite.not_found': 404,
     'invite.revoked': 410,
     'invite.expired': 410,
     'invite.uses_exhausted': 410,
     'invite.already_used_by_user': 409,
   }

   if (e instanceof InviteError) {
     throw createError({
       statusCode: codeToStatus[e.code] ?? 400,
       statusMessage: e.message,
       data: { code: e.code },
     })
   }
   ```

## Критерии приёмки

- ✅ `POST /api/organizations/:orgId/invites` — только owner может создавать
- ✅ Response включает `deeplinkUrl` для удобства
- ✅ `GET /api/organizations/:orgId/invites` — список с deeplinks
- ✅ `PATCH /.../invites/:inviteId { isRevoked: true }` — revoke
- ✅ Попытка изменить invite чужой org → 404
- ✅ `GET /api/invites/preview/:token` — БЕЗ AUTH работает, возвращает sanitized данные org
- ✅ `POST /api/invites/accept { token }` — auth required
- ✅ Ошибки маппятся в правильные HTTP статусы (410 для expired/revoked/exhausted)
- ✅ После accept — member создан или реактивирован (status зависит от org.default_member_status)

## Подсказки

- **Public endpoint `/api/invites/preview/`** — НЕ под `/api/organizations/`, поэтому tenant middleware не применяется. Это правильно — preview доступен без membership.
- **Deeplink URL формат:** `https://t.me/<bot>?start=org_<token>`. В UI будет «копировать ссылку» кнопка.
- **HTTP 410 (Gone) для expired/revoked/exhausted** — семантически правильно: ресурс существовал, но больше не доступен.

## Не делать

- ❌ Не возвращать `createdByUserId` в public preview — может быть privacy concern
- ❌ Не делать regenerate token endpoint — лучше revoke + new
- ❌ Не позволять editing invite параметров после создания — только revoke + new
