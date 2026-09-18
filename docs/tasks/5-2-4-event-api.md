---
id: '5.2.4'
phase: '5'
epic: '5.2'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '5.2.3'
  - '4.5.1'
estimated_hours: '1-2'
tags:
  - api
  - events
  - nuxt
---

# Task 5.2.4: Event API endpoints + permissions

## Цель

REST endpoints для events под `/api/organizations/:orgId/events`. Чтение — любой member, мутации — owner/organizer.

## Контекст

Тонкие обёртки над eventService. Booking endpoints (записаться на событие) — отдельно в 5.7, не здесь.

## Что должно быть сделано

1. **`events/index.get.ts`** — список (requireOrgMember):

   ```ts
   export default defineEventHandler(async (event) => {
     requireOrgMember(event.context.member)
     const ctx = createServiceContextFromEvent(event)
     const query = getQuery(event)
     const events = await eventService.list(ctx, event.context.organization!.id, query)
     return { events }
   })
   ```

2. **`events/index.post.ts`** — создать (requireCanManageContent):

   ```ts
   try {
     requireCanManageContent(event.context.member)
     const ctx = createServiceContextFromEvent(event)
     const body = await readBody(event)
     const created = await eventService.create(ctx, event.context.organization!.id, body)
     return { event: created }
   } catch (e) {
     return handleServiceError(e)
   }
   ```

3. **`events/[eventId]/index.get.ts`** — детали (requireOrgMember):
   - getById, проверить org ownership (event.organizationId === context.org.id) → 404 иначе
   - вернуть с counts (confirmedCount/waitlistCount/availableSpots) — отдельный enrichment или reuse list logic для single

4. **`events/[eventId]/index.patch.ts`** — обновить (requireCanManageContent):
   - проверка org ownership
   - update

5. **`events/[eventId]/cancel.post.ts`** — отменить (requireCanManageContent):
   - проверка org ownership
   - cancel

6. **Расширить handle-errors** — EventError codes:
   ```ts
   const codeToStatus = {
     ...existing,
     'event.not_found': 404,
     'event.not_published': 409,
     'event.cancelled': 410,
     'event.capacity_below_confirmed': 422,
     'event.venue_org_mismatch': 422,
   }
   if (e instanceof EventError) {
     /* map */
   }
   ```

## Критерии приёмки

- ✅ GET events list/single — любой active member
- ✅ POST/PATCH/cancel — только owner/organizer (403 для player)
- ✅ Cross-org: event из чужой org → 404
- ✅ Single event возвращает counts
- ✅ Ошибки маппятся (capacity_below_confirmed → 422, venue_mismatch → 422)
- ✅ Tenant middleware применяется

## Подсказки

- **Org ownership check во всех [eventId] endpoints** — обязательно. eventId в URL может быть из чужой org.
- **Single event counts** — можно сделать `eventService.getByIdWithCounts` или переиспользовать countsForEvents([id]).

## Не делать

- ❌ Не делать booking endpoints здесь — это 5.7
- ❌ Не делать UI — 5.9-5.11
- ❌ Не делать DELETE (физическое удаление) — только cancel
