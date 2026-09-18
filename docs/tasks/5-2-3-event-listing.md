---
id: '5.2.3'
phase: '5'
epic: '5.2'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '5.2.2'
estimated_hours: '2'
tags:
  - service
  - events
  - listing
---

# Task 5.2.3: Event listing с фильтрами + computed counts

## Цель

Реализовать листинг событий с фильтрами (upcoming/past, status) и вычисляемыми полями: confirmed_count, waitlist_count, available_spots.

## Контекст

UI показывает список событий с индикатором «8/12 мест, 3 в листе ожидания». Эти counts вычисляются по bookings, не хранятся в event (избегаем рассинхрона).

Поскольку bookings — это 5.3, в этой задаче подготовим listing с заглушкой counts (0), а реальные counts подключатся после 5.3. Либо реализуем listing полностью если 5.3.1 (schema) уже готова.

## Что должно быть сделано

1. **`schemas.ts`** — добавить фильтры:

   ```ts
   export const ListEventsQuery = z.object({
     filter: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
     status: z.enum(['draft', 'published', 'closed', 'finished', 'cancelled']).optional(),
     limit: z.coerce.number().int().min(1).max(100).default(50),
     offset: z.coerce.number().int().min(0).default(0),
   })
   export type ListEventsQuery = z.infer<typeof ListEventsQuery>
   ```

2. **`repository.ts`** — listing + counts:

   ```ts
   import { events, bookings } from '@volley-time/db'
   import { eq, and, gte, lt, desc, asc, sql, inArray } from 'drizzle-orm'

   export const eventRepository = {
     // ... create, getById, update

     async listByOrg(
       db: DB,
       orgId: number,
       opts: {
         filter: 'upcoming' | 'past' | 'all'
         status?: string
         limit: number
         offset: number
       },
     ) {
       const now = new Date()
       const conditions = [eq(events.organizationId, orgId)]
       if (opts.filter === 'upcoming') conditions.push(gte(events.startsAt, now))
       if (opts.filter === 'past') conditions.push(lt(events.startsAt, now))
       if (opts.status) conditions.push(eq(events.status, opts.status as any))

       const where = and(...conditions)
       const orderCol = opts.filter === 'past' ? desc(events.startsAt) : asc(events.startsAt)

       return db.query.events.findMany({
         where,
         orderBy: [orderCol],
         limit: opts.limit,
         offset: opts.offset,
         with: { venue: true },
       })
     },

     /**
      * Считает confirmed и waitlisted для набора событий одним запросом.
      * Возвращает Map<eventId, { confirmed, waitlisted }>.
      */
     async countsForEvents(
       db: DB,
       eventIds: number[],
     ): Promise<Map<number, { confirmed: number; waitlisted: number }>> {
       if (eventIds.length === 0) return new Map()
       const rows = await db
         .select({
           eventId: bookings.eventId,
           status: bookings.status,
           count: sql<number>`count(*)::int`,
         })
         .from(bookings)
         .where(
           and(
             inArray(bookings.eventId, eventIds),
             inArray(bookings.status, ['confirmed', 'waitlisted']),
           ),
         )
         .groupBy(bookings.eventId, bookings.status)

       const map = new Map<number, { confirmed: number; waitlisted: number }>()
       for (const id of eventIds) map.set(id, { confirmed: 0, waitlisted: 0 })
       for (const r of rows) {
         const entry = map.get(r.eventId)!
         if (r.status === 'confirmed') entry.confirmed = r.count
         if (r.status === 'waitlisted') entry.waitlisted = r.count
       }
       return map
     },

     async countConfirmed(db: DB, eventId: number): Promise<number> {
       const [row] = await db
         .select({ count: sql<number>`count(*)::int` })
         .from(bookings)
         .where(and(eq(bookings.eventId, eventId), eq(bookings.status, 'confirmed')))
       return row?.count ?? 0
     },
   }
   ```

3. **`service.ts`** — list с enrichment:
   ```ts
   async list(ctx: ServiceContext, orgId: number, query: ListEventsQuery) {
     const parsed = ListEventsQuery.parse(query)
     const db = getDb(ctx)
     const events = await eventRepository.listByOrg(db, orgId, parsed)
     const counts = await eventRepository.countsForEvents(db, events.map((e) => e.id))

     return events.map((e) => {
       const c = counts.get(e.id) ?? { confirmed: 0, waitlisted: 0 }
       return {
         ...e,
         confirmedCount: c.confirmed,
         waitlistCount: c.waitlisted,
         availableSpots: Math.max(0, e.capacity - c.confirmed),
       }
     })
   },
   ```

## Критерии приёмки

- ✅ filter=upcoming → события с startsAt >= now, сортировка ASC
- ✅ filter=past → startsAt < now, сортировка DESC
- ✅ filter=all → все, ASC
- ✅ status фильтр работает
- ✅ Каждое событие enriched: confirmedCount, waitlistCount, availableSpots
- ✅ availableSpots = max(0, capacity - confirmed)
- ✅ counts вычисляются ОДНИМ запросом для всех событий (не N+1)
- ✅ pagination (limit/offset)
- ✅ venue подгружается (with)

## Подсказки

- **N+1 защита:** countsForEvents берёт все eventIds разом, GROUP BY. Не делать запрос per-event.
- **Зависимость от bookings schema (5.3.1):** этот код импортирует `bookings`. Если 5.3.1 ещё не готова — закоммить schema bookings первой, либо temp-заглушка counts=0. Рекомендуется делать 5.3.1 (schema) перед 5.2.3.
- **availableSpots может быть 0** — значит запись пойдёт в waitlist. UI это показывает.

## Не делать

- ❌ Не делать cursor pagination — offset достаточно
- ❌ Не кешировать counts — вычисляем на лету (для MVP объёмов быстро)
- ❌ Не делать полнотекстовый поиск — Phase 14+
