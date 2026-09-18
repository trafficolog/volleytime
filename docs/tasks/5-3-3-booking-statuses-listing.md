---
id: '5.3.3'
phase: '5'
epic: '5.3'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - BACK
depends_on:
  - '5.3.2'
estimated_hours: '1-2'
tags:
  - service
  - bookings
  - listing
---

# Task 5.3.3: Booking statuses + listing (event/my)

## Цель

Методы листинга: `listByEvent` (для admin — кто записан), `listMyBookings` (для игрока — мои записи, upcoming/past).

## Контекст

UI показывает два среза: организатор видит состав события, игрок видит свои записи. Оба с enrichment (данные user / event).

## Что должно быть сделано

1. **`repository.ts` — listing методы:**

   ```ts
   async listByEvent(db: DB, eventId: number) {
     return db.query.bookings.findMany({
       where: eq(bookings.eventId, eventId),
       with: { user: true },
       orderBy: (b, { asc }) => [asc(b.bookedAt)],
     })
   },

   async listByUser(db: DB, orgId: number, userId: number, filter: 'upcoming' | 'past' | 'all') {
     // join events для фильтра по времени и enrichment
     const now = new Date()
     const rows = await db.query.bookings.findMany({
       where: and(eq(bookings.organizationId, orgId), eq(bookings.userId, userId)),
       with: { event: { with: { venue: true } } },
       orderBy: (b, { desc }) => [desc(b.bookedAt)],
     })
     // фильтрация по времени события на app-level (или через join в SQL для больших объёмов)
     if (filter === 'all') return rows
     return rows.filter((r) => {
       const startsAt = r.event.startsAt
       return filter === 'upcoming' ? startsAt >= now : startsAt < now
     })
   },
   ```

2. **`service.ts`:**

   ```ts
   async listByEvent(ctx: ServiceContext, eventId: number) {
     return bookingRepository.listByEvent(getDb(ctx), eventId)
   },

   async listMyBookings(ctx: ServiceContext, orgId: number, filter: 'upcoming' | 'past' | 'all' = 'upcoming') {
     return bookingRepository.listByUser(getDb(ctx), orgId, ctx.userId, filter)
   },

   async getById(ctx: ServiceContext, bookingId: number) {
     const b = await bookingRepository.getById(getDb(ctx), bookingId)
     if (!b) throw new BookingNotFoundError(bookingId)
     return b
   },
   ```

3. **Группировка для admin-view:** listByEvent возвращает all bookings; UI/API разделит на confirmed/waitlisted/etc. Можно добавить helper:
   ```ts
   async listByEventGrouped(ctx: ServiceContext, eventId: number) {
     const all = await this.listByEvent(ctx, eventId)
     return {
       confirmed: all.filter((b) => b.status === 'confirmed'),
       waitlisted: all.filter((b) => b.status === 'waitlisted'),
       pendingPayment: all.filter((b) => b.status === 'pending_payment'),
       attended: all.filter((b) => b.status === 'attended'),
       noShow: all.filter((b) => b.status === 'no_show'),
       cancelled: all.filter((b) => b.status === 'cancelled'),
     }
   },
   ```

## Критерии приёмки

- ✅ listByEvent → все bookings события с user data, отсортированы по bookedAt (FIFO)
- ✅ listMyBookings → записи user в org с event data
- ✅ filter upcoming/past по event.startsAt
- ✅ listByEventGrouped разбивает по статусам
- ✅ Waitlisted отсортированы по bookedAt (порядок очереди виден)

## Подсказки

- **Сортировка waitlist по bookedAt ASC** — критично для FIFO promotion. Кто раньше записался — первый в очереди.
- **filter на app-level** для MVP объёмов ок. При росте — перенести в SQL JOIN с WHERE по event.startsAt.
- **listByEvent для admin** — показывает всех включая cancelled (история). UI решит что показывать.

## Не делать

- ❌ Не делать pagination для bookings события (обычно < 50)
- ❌ Не делать экспорт — Phase 14
- ❌ Не делать поиск по участникам — Phase 14
