---
id: '5.2.2'
phase: '5'
epic: '5.2'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - BACK
depends_on:
  - '5.2.1'
estimated_hours: '2-3'
tags:
  - service
  - events
---

# Task 5.2.2: EventService (CRUD + cancel)

## Цель

EventService с create, getById, update, cancel. Валидация (время, capacity, venue ownership).

## Контекст

Сервис — бизнес-логика событий. Не занимается bookings (это 5.3), только сам event и его метаданные/статусы.

## Что должно быть сделано

1. **Модуль `apps/web/modules/events/`** (service, repository, schemas, errors, index).

2. **`schemas.ts`:**

   ```ts
   import { z } from 'zod'

   export const CreateEventInput = z
     .object({
       type: z.enum(['training', 'open_game', 'custom']).default('training'),
       title: z.string().min(2).max(200),
       description: z.string().max(2000).optional(),
       venueId: z.number().int().positive().optional(),
       locationText: z.string().max(300).optional(),
       startsAt: z.coerce.date(),
       endsAt: z.coerce.date(),
       capacity: z.number().int().positive().max(500),
       price: z.number().int().min(0).default(0),
       currency: z.string().length(3).default('BYN'),
       cancellationDeadlineHours: z.number().int().min(0).max(720).nullable().optional(),
     })
     .refine((d) => d.endsAt > d.startsAt, {
       message: 'endsAt must be after startsAt',
       path: ['endsAt'],
     })
   export type CreateEventInput = z.infer<typeof CreateEventInput>

   export const UpdateEventInput = z.object({
     title: z.string().min(2).max(200).optional(),
     description: z.string().max(2000).nullable().optional(),
     venueId: z.number().int().positive().nullable().optional(),
     locationText: z.string().max(300).nullable().optional(),
     startsAt: z.coerce.date().optional(),
     endsAt: z.coerce.date().optional(),
     capacity: z.number().int().positive().max(500).optional(),
     price: z.number().int().min(0).optional(),
     cancellationDeadlineHours: z.number().int().min(0).max(720).nullable().optional(),
     status: z.enum(['draft', 'published', 'closed', 'finished']).optional(),
   })
   export type UpdateEventInput = z.infer<typeof UpdateEventInput>
   ```

3. **`errors.ts`:**

   ```ts
   export class EventError extends Error {
     code: string
     constructor(code: string, message: string) {
       super(message)
       this.code = code
       this.name = 'EventError'
     }
   }
   export class EventNotFoundError extends EventError {
     constructor(id: number | string) {
       super('event.not_found', `Event ${id} not found`)
     }
   }
   export class EventNotPublishedError extends EventError {
     constructor() {
       super('event.not_published', 'Event is not open for booking')
     }
   }
   export class EventCancelledError extends EventError {
     constructor() {
       super('event.cancelled', 'Event is cancelled')
     }
   }
   export class CapacityBelowConfirmedError extends EventError {
     constructor() {
       super('event.capacity_below_confirmed', 'Cannot reduce capacity below confirmed bookings')
     }
   }
   export class VenueOrgMismatchError extends EventError {
     constructor() {
       super('event.venue_org_mismatch', 'Venue does not belong to this organization')
     }
   }
   ```

4. **`service.ts`:**

   ```ts
   import { getDb, type ServiceContext } from '../shared/context'
   import { eventRepository } from './repository'
   import { CreateEventInput, UpdateEventInput } from './schemas'
   import { EventNotFoundError, CapacityBelowConfirmedError, VenueOrgMismatchError } from './errors'
   import { venues } from '@volley-time/db'
   import { eq } from 'drizzle-orm'

   export const eventService = {
     async create(ctx: ServiceContext, orgId: number, input: CreateEventInput) {
       const parsed = CreateEventInput.parse(input)
       const db = getDb(ctx)

       // venue ownership check
       if (parsed.venueId) {
         const venue = await db.query.venues.findFirst({ where: eq(venues.id, parsed.venueId) })
         if (!venue || venue.organizationId !== orgId) throw new VenueOrgMismatchError()
       }

       return eventRepository.create(db, {
         organizationId: orgId,
         createdByUserId: ctx.userId,
         type: parsed.type,
         title: parsed.title,
         description: parsed.description,
         venueId: parsed.venueId,
         locationText: parsed.locationText,
         startsAt: parsed.startsAt,
         endsAt: parsed.endsAt,
         capacity: parsed.capacity,
         price: parsed.price,
         currency: parsed.currency,
         cancellationDeadlineHours: parsed.cancellationDeadlineHours ?? null,
         status: 'published',
       })
     },

     async getById(ctx: ServiceContext, eventId: number) {
       const e = await eventRepository.getById(getDb(ctx), eventId)
       if (!e) throw new EventNotFoundError(eventId)
       return e
     },

     async update(ctx: ServiceContext, eventId: number, input: UpdateEventInput) {
       const parsed = UpdateEventInput.parse(input)
       const db = getDb(ctx)
       const event = await this.getById(ctx, eventId)

       // venue ownership
       if (parsed.venueId) {
         const venue = await db.query.venues.findFirst({ where: eq(venues.id, parsed.venueId) })
         if (!venue || venue.organizationId !== event.organizationId)
           throw new VenueOrgMismatchError()
       }

       // capacity не ниже confirmed
       if (parsed.capacity !== undefined) {
         const confirmedCount = await eventRepository.countConfirmed(db, eventId)
         if (parsed.capacity < confirmedCount) throw new CapacityBelowConfirmedError()
       }

       return eventRepository.update(db, eventId, parsed)
     },

     async cancel(ctx: ServiceContext, eventId: number) {
       const event = await this.getById(ctx, eventId)
       if (event.status === 'cancelled') return event
       return eventRepository.update(getDb(ctx), eventId, { status: 'cancelled' })
       // NOTE: mass refund/restore bookings — Phase 6. В Phase 5 просто меняем статус.
     },
   }
   ```

5. **`repository.ts`** — create, getById, update, countConfirmed (COUNT bookings where status=confirmed). Метод countConfirmed понадобится из bookings (5.3) — пока заглушка возвращает 0, реализуется после 5.3.1.

## Критерии приёмки

- ✅ create валидирует: endsAt > startsAt (Zod refine), venue принадлежит org
- ✅ create устанавливает status=published, createdByUserId=ctx.userId
- ✅ update проверяет: новый capacity не ниже confirmed_count
- ✅ update venue ownership
- ✅ cancel идемпотентен, меняет status (без refund в Phase 5)
- ✅ getById → EventNotFoundError если нет
- ✅ Все ошибки с понятными codes

## Подсказки

- **countConfirmed зависит от bookings (5.3)** — временно заглушка `return 0`, после 5.3.1 реальный COUNT. Или вынеси проверку capacity в booking-логику. Зависимость 5.2 ← 5.3 циклична на уровне countConfirmed — реши через late binding (bookingRepository.countByEventStatus вызывается из eventService после реализации 5.3).
- **Mass refund при cancel** — НЕ в Phase 5. Phase 6 добавит «отмена события → restore всем сессии + refund cash». Сейчас cancel просто меняет статус.
- **price валидация min 0** — бесплатные события разрешены.

## Не делать

- ❌ Не делать booking логику
- ❌ Не делать mass refund при cancel — Phase 6
- ❌ Не делать recurring — Phase 15
- ❌ Не делать draft→published workflow (создаём сразу published)
