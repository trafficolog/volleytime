---
id: '15.6.1'
phase: '15'
epic: '15.6'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: 'TTL только для online (Phase 12). Cash НЕ трогаем.'
roles:
  - BACK
depends_on:
  - '15.1.1'
  - '6.1.1'
estimated_hours: '1-2'
tags:
  - ttl
  - payments
  - online-ready
---

# Task 15.6.1: pending_ttl механизм (online-only) + handler

## Цель

Механизм TTL для pending_payment: online-бронь висит N минут → авто-отмена + offer следующему. ТОЛЬКО method=online (Phase 12); cash/transfer НЕ получают TTL.

## Контекст

Решение 5 (тонкий момент): cash/transfer подтверждает организатор вручную (часы) — TTL сломал бы это. TTL только для online (Phase 12, игрок платит сам, спешка осмысленна). Механизм готовим, до Phase 12 фактически не активен.

## Что должно быть сделано

1. **Регистрация TTL только для online** — в bookingService.book (5.3.2), при создании pending_payment:

   ```ts
   // book(), после создания pending_payment booking:
   if (booking.status === 'pending_payment' && booking.method === 'online') {
     // ТОЛЬКО online — cash/transfer НЕ получают TTL (ждут организатора)
     const ttl = new Date(Date.now() + PENDING_TTL_MINUTES * 60_000) // дефолт 15 мин
     await scheduleBookingPendingTtl(booking.id, ttl)
   }
   // cash/transfer: НЕ ставим TTL — организатор подтверждает без спешки (6.5)
   ```

2. **PENDING_TTL_MINUTES конфиг** (env, дефолт 15). Активируется в Phase 12.

3. **Handler `apps/bot/src/jobs/handlers/pending-ttl.ts`:**

   ```ts
   export const pendingTtlJob = defineJob<BookingTtlPayload>(
     JOB_TYPES.BOOKING_PENDING_TTL,
     async ({ bookingId }) => {
       await db.transaction(async (tx) => {
         const booking = await tx.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
         // актуальность: всё ещё pending_payment online?
         if (!booking || booking.status !== 'pending_payment' || booking.method !== 'online') return
         // оплата не пришла за TTL → отмена
         await tx
           .update(bookings)
           .set({ status: 'cancelled', cancelledAt: new Date() })
           .where(eq(bookings.id, bookingId))
         // освободилось место → offer следующему (15.5.1 confirm-flow)
         await bookingService.offerToWaitlist({ ...systemCtx, db: tx }, booking.eventId)
         // отменить связанный online payment если есть (Phase 12)
       })
     },
   )
   ```

4. **Cash/transfer защита** — handler дополнительно проверяет method==online (не отменит cash даже если задача как-то создалась). Двойная защита.

5. **Документировать активацию в Phase 12** — до online-оплаты TTL не ставится (нет online-броней). Механизм готов, ждёт Phase 12.

6. **Тесты:**
   ```ts
   test('online pending booking gets TTL job', async () => {})
   test('cash pending booking does NOT get TTL', async () => {})
   test('transfer pending booking does NOT get TTL', async () => {})
   test('TTL expires online unpaid → cancelled + offer next', async () => {})
   test('handler ignores non-online even if invoked', async () => {})
   test('paid before TTL → handler no-op', async () => {})
   ```

## Критерии приёмки

- ✅ TTL-задача регистрируется ТОЛЬКО для method=online pending_payment
- ✅ cash/transfer НЕ получают TTL (ждут организатора)
- ✅ Handler: online не оплачен за TTL → cancelled + offer следующему
- ✅ Handler-защита: method != online → пропуск (даже если вызван)
- ✅ Оплачен до TTL → no-op (актуальность)
- ✅ PENDING_TTL_MINUTES конфиг (дефолт 15)
- ✅ Документировано: активируется Phase 12
- ✅ Тесты

## Подсказки

- **Двойная защита cash:** не ставим TTL для cash (регистрация) + handler проверяет method==online (выполнение). Даже если задача создалась ошибочно — не отменит наличные.
- **До Phase 12 не активен** — нет online-броней (online-метод появится в Phase 12). Механизм готов, но не срабатывает. Это нормально — закладываем инфраструктуру.
- **offer следующему** — освободившееся место идёт в confirm-flow (15.5.1), не вслепую.
- **Почему не cash:** организатор подтверждает наличные вручную (6.5), может быть не у телефона час. TTL 15 мин отменил бы бронь до подтверждения — потеря записи. Решение 5 это явно исключает.

## Не делать

- ❌ Не ставить TTL для cash/transfer (сломает ручное подтверждение)
- ❌ Не отменять без проверки method==online (защита)
- ❌ Не активировать раньше Phase 12 (нет online)
