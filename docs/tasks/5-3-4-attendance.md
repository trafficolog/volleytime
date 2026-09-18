---
id: '5.3.4'
phase: '5'
epic: '5.3'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '5.3.3'
estimated_hours: '1'
tags:
  - service
  - bookings
  - attendance
---

# Task 5.3.4: markAttendance (attended/no_show)

## Цель

Метод `markAttendance` — организатор отмечает, пришёл игрок или нет. confirmed → attended/no_show.

## Контекст

После события организатор отмечает посещаемость. Это основа для будущей аналитики (Phase 14) и no-show tracking (Phase 18 CRM).

В Phase 5 — простая отметка, без аналитики.

## Что должно быть сделано

1. **`service.ts`:**

   ```ts
   async markAttendance(
     ctx: ServiceContext,
     bookingId: number,
     attendance: 'attended' | 'no_show',
   ) {
     const db = getDb(ctx)
     const booking = await this.getById(ctx, bookingId)

     // Можно отмечать только confirmed (или уже отмеченные — переотметка)
     if (!['confirmed', 'attended', 'no_show'].includes(booking.status)) {
       throw new BookingError('booking.cannot_mark_attendance', `Cannot mark attendance for status ${booking.status}`)
     }

     const [updated] = await db.update(bookings)
       .set({ status: attendance, updatedAt: new Date() })
       .where(eq(bookings.id, bookingId))
       .returning()
     return updated!
   }
   ```

2. **Bulk attendance (опционально, удобно для UI):**

   ```ts
   async markAttendanceBulk(
     ctx: ServiceContext,
     eventId: number,
     records: Array<{ bookingId: number; attendance: 'attended' | 'no_show' }>,
   ) {
     const db = getDb(ctx)
     return await db.transaction(async (tx) => {
       const results = []
       for (const r of records) {
         // verify booking belongs to event (security)
         const b = await tx.query.bookings.findFirst({ where: eq(bookings.id, r.bookingId) })
         if (!b || b.eventId !== eventId) continue
         const [u] = await tx.update(bookings)
           .set({ status: r.attendance, updatedAt: new Date() })
           .where(eq(bookings.id, r.bookingId)).returning()
         results.push(u!)
       }
       return results
     })
   }
   ```

3. **Error:** добавить `booking.cannot_mark_attendance` → 422 в handle-errors.

## Критерии приёмки

- ✅ confirmed → attended работает
- ✅ confirmed → no_show работает
- ✅ Переотметка (attended → no_show) работает
- ✅ Нельзя отметить waitlisted/cancelled/pending_payment → ошибка
- ✅ Bulk: отмечает несколько, проверяет принадлежность к событию
- ✅ Cross-event security: booking из другого события пропускается в bulk

## Подсказки

- **Зачем разрешать переотметку:** организатор мог ошибиться. attended ↔ no_show должно переключаться.
- **Bulk удобен для UI:** организатор открывает список, отмечает галочками, сохраняет одним запросом.
- **no_show для аналитики:** в Phase 18 (CRM) будет no-show rate per player. Сейчас просто храним факт.

## Не делать

- ❌ Не делать no-show penalties/scoring — Phase 18
- ❌ Не делать авто-no_show (не отметили = no_show) — Phase 15
- ❌ Не делать attendance для waitlisted (они не играли)
