---
id: '7.3.2'
phase: '7'
epic: '7.3'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: 'Refund при отмене Event до открытия записи.'
roles:
  - BACK
depends_on:
  - '7.3.1'
  - '5.2.2'
estimated_hours: '1-2'
tags:
  - credits
  - events
  - refund
---

# Task 7.3.2: Refund при отмене до открытия записи

## Цель

Отмена Event до открытия записи → refund 1 credit. После открытия записи (были брони) — credit потрачен (не возвращается).

## Контекст

Решение 1: refund до открытия записи (не наказываем за тест/ошибку), после — потрачено (организатор получил ценность). Нужно определить «открытие записи».

## Что должно быть сделано

1. **Определение «запись открывалась»:** простейший критерий — были ли какие-либо брони (включая отменённые) на событие. Если ни одной брони не было → запись фактически не использовалась → refund. Если хоть одна была → ценность получена → нет refund.

   ```ts
   async function wasRegistrationUsed(tx, eventId: number): Promise<boolean> {
     const anyBooking = await tx.query.bookings.findFirst({ where: eq(bookings.eventId, eventId) })
     return !!anyBooking
   }
   ```

   Альтернатива: явный флаг event.registrationOpenedAt или статус. Для MVP — наличие броней достаточно.

2. **Расширить eventService.cancel (5.2.2 / 6.4.1 mass refund):**

   ```ts
   async cancel(ctx, eventId) {
     return await db.transaction(async (tx) => {
       const event = await this.getById({ ...ctx, db: tx }, eventId)
       if (event.status === 'cancelled') return event  // idempotent

       const registrationUsed = await wasRegistrationUsed(tx, eventId)

       // ... mass refund игрокам (6.4.1) ...
       // ... event → cancelled ...

       // credit refund платформы — только если запись не использовалась
       if (!registrationUsed) {
         await creditService.addTransaction({ ...ctx, db: tx }, {
           organizationId: event.organizationId,
           type: 'refund',
           amount: 1,
           eventId: event.id,
           note: `Возврат credit за отменённое событие «${event.title}» (запись не открывалась)`,
         })
       }

       return cancelled
     })
   }
   ```

3. **Идемпотентность:** повторная отмена не делает второй refund (event уже cancelled → ранний возврат).

4. **Координация с 6.4.1 (mass refund игрокам):** это РАЗНЫЕ refund. 6.4.1 возвращает игрокам (деньги/сессии). 7.3.2 возвращает credit платформы организатору. Оба в одной cancel-транзакции, не путать.

5. **Тесты:**
   ```ts
   test('cancel event with no bookings → credit refunded', async () => {})
   test('cancel event with bookings → credit NOT refunded', async () => {})
   test('cancel with cancelled booking only → still counts as used (no refund)', async () => {})
   test('double cancel → single refund (idempotent)', async () => {})
   test('credit refund separate from player mass refund', async () => {})
   ```

## Критерии приёмки

- ✅ Отмена без броней → refund +1 credit
- ✅ Отмена с бронями (любыми, вкл. отменённые) → НЕ refund
- ✅ Идемпотентно (двойная отмена → один refund)
- ✅ credit refund отделён от player mass refund (6.4.1)
- ✅ refund transaction linked to eventId
- ✅ Атомарно в cancel-транзакции
- ✅ Тесты

## Подсказки

- **«Запись использовалась» = были брони** — простой критерий. Создал событие, никто не записался, отменил → возврат (тест/ошибка). Кто-то записался → ценность была → потрачено.
- **Отменённые брони тоже считаются** — если игрок записался и отменился, запись всё равно «открывалась» (событие работало). Строгий критерий: ЛЮБАЯ бронь когда-либо → нет refund.
- **Два разных refund в cancel** — игрокам (6.4.1: деньги/сессии) и платформе→организатору (7.3.2: credit). Не путать, оба в одной транзакции.
- **Идемпотентность через статус** — cancelled событие → ранний return, второй refund невозможен.

## Не делать

- ❌ Не возвращать credit если были брversions (ценность получена)
- ❌ Не путать с player mass refund (6.4.1)
- ❌ Не делать двойной refund (идемпотентность)
