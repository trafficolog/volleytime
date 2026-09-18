---
id: '5.6.1'
phase: '5'
epic: '5.6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - BACK
depends_on:
  - '5.3.2'
  - '5.5.4'
estimated_hours: '2'
tags:
  - bookings
  - cancellation
  - core
---

# Task 5.6.1: BookingService.cancel + deadline check + restore

## Цель

`BookingService.cancel` — отмена брони: проверка cancellation deadline, restore сессии (если был с абонемента), status → cancelled. Освобождение слота триггерит promotion (5.6.2).

## Контекст

Решение 14: cancellation deadline настраивается per-event (event.cancellationDeadlineHours). После дедлайна игрок не может отменить, но owner/organizer могут (bypass).

Если бронь была с абонемента — restoreSession (5.5.4). Если был confirmed слот — после отмены продвигаем waitlist (5.6.2).

## Что должно быть сделано

1. **`service.ts` — cancel:**

   ```ts
   import { BookingDeadlinePassedError, BookingNotFoundError } from './errors'
   import { subscriptionService } from '../subscriptions'
   import { events, bookings, organizationMembers } from '@volley-time/db'

   async cancel(ctx: ServiceContext, bookingId: number, opts: { byAdmin?: boolean } = {}) {
     const db = getDb(ctx)

     return await db.transaction(async (tx) => {
       const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
       if (!booking) throw new BookingNotFoundError(bookingId)

       // Idempotent
       if (booking.status === 'cancelled') return { booking, promoted: null }

       const event = await tx.query.events.findFirst({ where: eq(events.id, booking.eventId) })
       if (!event) throw new BookingNotFoundError(bookingId)

       // Permission: свой booking ИЛИ admin
       const isSelf = booking.userId === ctx.userId
       if (!isSelf && !opts.byAdmin) {
         throw new BookingError('booking.cannot_cancel_others', 'Cannot cancel another user booking')
       }

       // Cancellation deadline (только для self; admin bypass)
       if (isSelf && !opts.byAdmin && event.cancellationDeadlineHours != null) {
         const deadline = new Date(event.startsAt.getTime() - event.cancellationDeadlineHours * 3600_000)
         if (new Date() > deadline) {
           throw new BookingDeadlinePassedError()
         }
       }

       const wasConfirmed = booking.status === 'confirmed'

       // Restore subscription session (если был)
       if (booking.subscriptionId) {
         await subscriptionService.restoreSession({ userId: booking.userId, db: tx }, booking.subscriptionId)
       }

       // Cancel booking
       const [cancelled] = await tx.update(bookings).set({
         status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date(),
       }).where(eq(bookings.id, bookingId)).returning()

       // Если освободился confirmed слот — promote waitlist (5.6.2)
       let promoted = null
       if (wasConfirmed) {
         promoted = await this.promoteFromWaitlist({ ...ctx, db: tx }, event.id)
       }

       return { booking: cancelled!, promoted }
     })
   },
   ```

2. **Error:** `booking.cannot_cancel_others` → 403, `booking.deadline_passed` → 422.

3. **Тесты:**
   ```ts
   test('cancel confirmed with subscription restores session', async () => {})
   test('cancel before deadline succeeds', async () => {})
   test('cancel after deadline fails for player', async () => {})
   test('admin can cancel after deadline', async () => {})
   test('cancel waitlisted does not trigger promotion', async () => {})
   test('cancel is idempotent', async () => {})
   test('cannot cancel another player booking', async () => {})
   ```

## Критерии приёмки

- ✅ Отмена confirmed с абонемента → restore session
- ✅ Cancellation deadline: после дедлайна player → BookingDeadlinePassedError
- ✅ Admin (byAdmin=true) bypass deadline
- ✅ deadline=null → отмена всегда разрешена
- ✅ Отмена confirmed → триггер promotion (5.6.2)
- ✅ Отмена waitlisted → без promotion
- ✅ Идемпотентность
- ✅ Нельзя отменить чужую бронь (если не admin)
- ✅ Всё в транзакции (restore + cancel + promote атомарны)

## Подсказки

- **deadline расчёт:** starts_at - deadlineHours. Например starts 19:00, deadline 2ч → нельзя отменять после 17:00.
- **byAdmin** передаётся из API (5.7.1) когда owner/organizer отменяет чужую бронь.
- **Транзакция критична:** restore + cancel + promote должны быть атомарны. Если promote упадёт — откатываем restore тоже.
- **promoted в ответе** — UI может показать «N продвинут из листа ожидания».

## Не делать

- ❌ Не делать refund денег (cash/online) — Phase 6
- ❌ Не делать уведомление отменившему/продвинутому — Phase 8
- ❌ Не делать mass cancel (отмена события) — Phase 6
