---
id: '5.7.1'
phase: '5'
epic: '5.7'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
depends_on:
  - '5.3.2'
  - '5.6.1'
  - '4.5.1'
estimated_hours: '2'
tags:
  - api
  - bookings
  - nuxt
---

# Task 5.7.1: Booking endpoints (book, cancel, my, list, attendance)

## Цель

REST endpoints для всех booking-операций: записаться, отменить, мои записи, список записей события (admin), отметка посещаемости (admin).

## Контекст

Тонкие обёртки над bookingService (5.3, 5.6). Все под tenant middleware. Permissions: book/cancel — active member; list event bookings / attendance — owner/organizer.

## Что должно быть сделано

1. **`events/[eventId]/book.post.ts`** — записаться:

   ```ts
   import { bookingService } from '~/modules/bookings'
   import { requireOrgMember } from '~/modules/permissions'
   import { createServiceContextFromEvent } from '~/modules/shared/context'
   import { handleServiceError } from '~/server/utils/handle-errors'

   export default defineEventHandler(async (event) => {
     try {
       requireOrgMember(event.context.member)
       const ctx = createServiceContextFromEvent(event)
       const eventId = Number(getRouterParam(event, 'eventId'))
       const body = await readBody(event)
       const booking = await bookingService.book(ctx, event.context.organization!.id, eventId, body)
       return { booking }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

2. **`bookings/[bookingId]/index.delete.ts`** — отменить:

   ```ts
   export default defineEventHandler(async (event) => {
     try {
       requireOrgMember(event.context.member)
       const ctx = createServiceContextFromEvent(event)
       const bookingId = Number(getRouterParam(event, 'bookingId'))

       // Загрузить booking, проверить org ownership
       const existing = await bookingService.getById(ctx, bookingId)
       if (existing.organizationId !== event.context.organization!.id) {
         throw createError({ statusCode: 404, statusMessage: 'Booking not found' })
       }

       // Admin может отменять чужие
       const isAdmin = ['owner', 'organizer'].includes(event.context.member!.role)
       const result = await bookingService.cancel(ctx, bookingId, { byAdmin: isAdmin })
       return { booking: result.booking, promoted: result.promoted }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

3. **`my/bookings/index.get.ts`** — мои записи:

   ```ts
   export default defineEventHandler(async (event) => {
     requireOrgMember(event.context.member)
     const ctx = createServiceContextFromEvent(event)
     const query = getQuery(event)
     const filter = (query.filter as 'upcoming' | 'past' | 'all') ?? 'upcoming'
     const bookings = await bookingService.listMyBookings(
       ctx,
       event.context.organization!.id,
       filter,
     )
     return { bookings }
   })
   ```

4. **`events/[eventId]/bookings/index.get.ts`** — список записей события (admin):

   ```ts
   export default defineEventHandler(async (event) => {
     requireCanManageContent(event.context.member)
     const ctx = createServiceContextFromEvent(event)
     const eventId = Number(getRouterParam(event, 'eventId'))
     // verify event belongs to org (через getById в eventService или прямой check)
     const grouped = await bookingService.listByEventGrouped(ctx, eventId)
     return grouped
   })
   ```

5. **`bookings/[bookingId]/attendance.patch.ts`** — отметка (admin):
   ```ts
   import { z } from 'zod'
   const AttendanceInput = z.object({ attendance: z.enum(['attended', 'no_show']) })

   export default defineEventHandler(async (event) => {
     try {
       requireCanManageContent(event.context.member)
       const ctx = createServiceContextFromEvent(event)
       const bookingId = Number(getRouterParam(event, 'bookingId'))
       const { attendance } = AttendanceInput.parse(await readBody(event))

       const existing = await bookingService.getById(ctx, bookingId)
       if (existing.organizationId !== event.context.organization!.id) {
         throw createError({ statusCode: 404, statusMessage: 'Booking not found' })
       }
       const updated = await bookingService.markAttendance(ctx, bookingId, attendance)
       return { booking: updated }
     } catch (e) {
       return handleServiceError(e)
     }
   })
   ```

## Критерии приёмки

- ✅ POST book — active member, body { method, subscriptionId? }, возвращает booking (confirmed/waitlisted/pending)
- ✅ DELETE booking — свой (player) или любой (admin byAdmin=true), возвращает booking + promoted
- ✅ GET my/bookings — фильтр upcoming/past
- ✅ GET event bookings — owner/organizer, grouped по статусам
- ✅ PATCH attendance — owner/organizer
- ✅ Cross-org защита везде (booking/event из чужой org → 404)
- ✅ Все ошибки через handleServiceError

## Подсказки

- **byAdmin определяется по роли:** owner/organizer → true (bypass deadline, может отменять чужие). Player → false.
- **promoted в ответе DELETE** — UI показывает «X продвинут из waitlist».
- **Cross-org check обязателен** — bookingId/eventId в URL.

## Не делать

- ❌ Не делать payment endpoints — Phase 6
- ❌ Не делать bulk attendance endpoint здесь (есть в service, можно добавить позже)
- ❌ Не делать UI — 5.9
