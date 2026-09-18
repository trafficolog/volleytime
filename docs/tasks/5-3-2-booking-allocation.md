---
id: '5.3.2'
phase: '5'
epic: '5.3'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - BACK
depends_on:
  - '5.3.1'
estimated_hours: '3-4'
tags:
  - service
  - bookings
  - core
---

# Task 5.3.2: BookingService.book — allocation (capacity/waitlist)

## Цель

Реализовать `BookingService.book` — запись игрока на событие с определением слота (confirmed если место есть, иначе waitlisted). Интеграция с subscription consume (для method=subscription). Reactivation для cancelled bookings.

## Контекст

Это **сердце Phase 5**. Логика из Python-прототипа, упрощённая до capacity + waitlist.

Алгоритм:

1. Валидация: event published, не cancelled, deadline записи не прошёл
2. Валидация: user — active member org
3. Проверка существующей брони (reactivation если cancelled)
4. Определение слота: confirmed_count < capacity → confirmed, иначе waitlisted
5. Если method=subscription → atomic consume (5.5.3), привязка subscriptionId
6. Если method=free (price=0) → сразу confirmed
7. Иначе → pending_payment (слот занят, оплата в Phase 6)

Concurrency-safe реализация — в 5.3.5 (отдельная задача с фокусом на atomic allocation). Здесь — основная логика, в 5.3.5 финализируем atomic-гарантии.

## Что должно быть сделано

1. **Модуль `apps/web/modules/bookings/`** (service, repository, schemas, errors, index).

2. **`schemas.ts`:**

   ```ts
   import { z } from 'zod'
   export const BookInput = z.object({
     method: z.enum(['subscription', 'cash', 'transfer', 'online', 'free']),
     subscriptionId: z.number().int().positive().optional(), // если method=subscription и хотим конкретный
   })
   export type BookInput = z.infer<typeof BookInput>
   ```

3. **`errors.ts`:**

   ```ts
   export class BookingError extends Error {
     code: string
     constructor(code: string, message: string) {
       super(message)
       this.code = code
       this.name = 'BookingError'
     }
   }
   export class AlreadyBookedError extends BookingError {
     constructor() {
       super('booking.already_booked', 'You are already booked for this event')
     }
   }
   export class EventNotBookableError extends BookingError {
     constructor(reason: string) {
       super('booking.event_not_bookable', `Event is not bookable: ${reason}`)
     }
   }
   export class BookingDeadlinePassedError extends BookingError {
     constructor() {
       super('booking.deadline_passed', 'Booking deadline has passed')
     }
   }
   export class NoActiveSubscriptionError extends BookingError {
     constructor() {
       super('booking.no_active_subscription', 'No active subscription with remaining sessions')
     }
   }
   export class BookingNotFoundError extends BookingError {
     constructor(id: number | string) {
       super('booking.not_found', `Booking ${id} not found`)
     }
   }
   ```

4. **`service.ts` — метод book:**
   ```ts
   import { getDb, type ServiceContext } from '../shared/context'
   import { bookings, events, organizationMembers } from '@volley-time/db'
   import { eq, and, sql } from 'drizzle-orm'
   import { BookInput } from './schemas'
   import { AlreadyBookedError, EventNotBookableError, BookingDeadlinePassedError } from './errors'
   import { subscriptionService } from '../subscriptions'

   export const bookingService = {
     async book(ctx: ServiceContext, orgId: number, eventId: number, input: BookInput) {
       const parsed = BookInput.parse(input)
       const db = getDb(ctx)

       return await db.transaction(async (tx) => {
         // 1. Load event, validate
         const event = await tx.query.events.findFirst({ where: eq(events.id, eventId) })
         if (!event || event.organizationId !== orgId) throw new EventNotBookableError('not found')
         if (event.status === 'cancelled') throw new EventNotBookableError('cancelled')
         if (event.status !== 'published') throw new EventNotBookableError('not open')

         // Booking deadline (отдельно от cancellation deadline): нельзя записаться после начала
         if (event.startsAt < new Date()) throw new EventNotBookableError('already started')

         // 2. Verify active membership (middleware уже проверил, но в сервисе для надёжности)
         const member = await tx.query.organizationMembers.findFirst({
           where: and(
             eq(organizationMembers.organizationId, orgId),
             eq(organizationMembers.userId, ctx.userId),
           ),
         })
         if (!member || (member.status !== 'active' && member.status !== 'pending')) {
           throw new EventNotBookableError('not a member')
         }

         // 3. Existing booking? (reactivation if cancelled)
         const existing = await tx.query.bookings.findFirst({
           where: and(eq(bookings.eventId, eventId), eq(bookings.userId, ctx.userId)),
         })
         if (existing && existing.status !== 'cancelled') {
           throw new AlreadyBookedError()
         }

         // 4. Determine slot: confirmed vs waitlisted (atomic count — финализируется в 5.3.5)
         const [{ confirmedCount }] = await tx
           .select({ confirmedCount: sql<number>`count(*)::int` })
           .from(bookings)
           .where(and(eq(bookings.eventId, eventId), eq(bookings.status, 'confirmed')))
         const hasSpot = confirmedCount < event.capacity

         // 5. Resolve method/status
         let status: 'confirmed' | 'waitlisted' | 'pending_payment'
         let method = parsed.method
         let subscriptionId: number | null = null
         let confirmedAt: Date | null = null

         if (!hasSpot) {
           // Нет места — в waitlist независимо от метода. Consume НЕ делаем (списываем при promotion).
           status = 'waitlisted'
           if (event.price === 0) method = 'free'
         } else if (event.price === 0) {
           status = 'confirmed'
           method = 'free'
           confirmedAt = new Date()
         } else if (parsed.method === 'subscription') {
           // Atomic consume (5.5.3). Бросает NoActiveSubscriptionError если нет сессий.
           const consumed = await subscriptionService.consumeSession(
             { userId: ctx.userId, db: tx },
             orgId,
             parsed.subscriptionId,
           )
           subscriptionId = consumed.subscriptionId
           status = 'confirmed'
           confirmedAt = new Date()
         } else {
           // cash/transfer/online → pending_payment, слот занят
           status = 'pending_payment'
         }

         // 6. Create or reactivate booking
         if (existing && existing.status === 'cancelled') {
           const [updated] = await tx
             .update(bookings)
             .set({
               status,
               method,
               subscriptionId,
               bookedAt: new Date(),
               confirmedAt,
               cancelledAt: null,
               updatedAt: new Date(),
             })
             .where(eq(bookings.id, existing.id))
             .returning()
           return updated!
         }

         const [created] = await tx
           .insert(bookings)
           .values({
             eventId,
             userId: ctx.userId,
             organizationId: orgId,
             status,
             method,
             subscriptionId,
             confirmedAt,
           })
           .returning()
         return created!
       })
     },
   }
   ```

## Критерии приёмки

- ✅ Запись при наличии места → confirmed
- ✅ Запись при заполненном capacity → waitlisted (consume НЕ происходит)
- ✅ method=subscription + место есть → atomic consume + confirmed + subscriptionId привязан
- ✅ Бесплатное событие (price=0) → method=free, confirmed
- ✅ cash/transfer → pending_payment, слот занят
- ✅ Повторная запись (active booking) → AlreadyBookedError
- ✅ Reactivation: cancelled booking → UPDATE обратно (не дубль)
- ✅ Event cancelled/not published/started → EventNotBookableError
- ✅ Не-член → отказ
- ✅ Вся логика в транзакции

## Подсказки

- **Waitlist + subscription:** если места нет, в waitlist НЕ списываем сессию. Списание произойдёт при promotion (5.6.2), когда слот освободится. Иначе сессия «зависнет» в waitlist.
- **Reactivation** — тот же паттерн что в Phase 4 members. Unique (event_id, user_id) требует UPDATE вместо INSERT для cancelled.
- **Concurrency:** в этой задаче count-then-insert имеет race window (между COUNT и INSERT другой может занять слот). Финальная atomic-защита — в 5.3.5. Здесь реализуем логику, 5.3.5 делает её concurrency-safe.
- **booking deadline vs cancellation deadline:** booking deadline = нельзя записаться после starts_at (хардкод). cancellation deadline = настраиваемый (5.6).

## Не делать

- ❌ Не делать payment confirm — Phase 6
- ❌ Не делать promotion здесь — 5.6
- ❌ Не делать уведомления — Phase 8
- ❌ Не финализировать atomic allocation — 5.3.5 (здесь основная логика)
