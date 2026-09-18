---
id: '15.4.1'
phase: '15'
epic: '15.4'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - BACK
depends_on:
  - '15.3.1'
  - '5.2.2'
  - '5.3.2'
estimated_hours: '1'
tags:
  - scheduler
  - events
  - auto-close
---

# Task 15.4.1: Auto-close (в reminder_2h) + блок новых записей

## Цель

За 2 ч до начала (момент reminder_2h) перевести Event published → closed. closed запрещает новые записи (book отклоняется), но НЕ запрещает отмену (отдельный deadline Phase 5).

## Контекст

Решение 4: auto-close за 2ч, совмещён с reminder_2h. closed = финальный состав зафиксирован (организатору готовиться). Отмена регулируется cancellationDeadlineHours (Phase 5) — не путать.

## Что должно быть сделано

1. **Расширить reminder2hJob (15.3.1)** — добавить close:

   ```ts
   export const reminder2hJob = defineJob<EventJobPayload>(
     JOB_TYPES.EVENT_REMINDER_2H,
     async ({ eventId }) => {
       await sendReminders(eventId, '2h') // 15.3.1
       await autoCloseEvent(eventId) // новое
     },
   )

   async function autoCloseEvent(eventId: number) {
     const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
     if (!event) return
     if (event.status === 'published') {
       // только published → closed
       await db
         .update(events)
         .set({ status: 'closed', updatedAt: new Date() })
         .where(eq(events.id, eventId))
     }
     // cancelled/closed/finished → пропуск (idempotent)
   }
   ```

2. **book отклоняет closed (расширить bookingService.book 5.3.2):**

   ```ts
   // в book(), проверка статуса:
   if (event.status !== 'published') {
     throw new BookingError('event_not_bookable', 'Запись на это событие закрыта')
   }
   // closed/cancelled/finished → нельзя записаться
   ```

   (если 5.3.2 уже проверяет published — closed автоматически блокирует)

3. **Отмена при closed РАЗРЕШЕНА** — bookingService.cancel НЕ проверяет event.status closed. Отмена регулируется cancellationDeadlineHours (Phase 5, per-event deadline). closed блокирует только НОВЫЕ записи.

4. **Idempotent** — повторный close (уже closed) → no-op.

5. **Тесты:**
   ```ts
   test('reminder_2h closes published event', async () => {})
   test('closed event rejects new booking', async () => {})
   test('closed event still allows cancellation (within Phase 5 deadline)', async () => {})
   test('already closed/cancelled → no-op', async () => {})
   ```

## Критерии приёмки

- ✅ reminder_2h переводит published → closed
- ✅ closed: book отклоняется (event_not_bookable)
- ✅ closed: отмена РАЗРЕШЕНА (deadline Phase 5 отдельно)
- ✅ Только published → closed (idempotent для других статусов)
- ✅ Тесты (close, блок book, отмена работает)

## Подсказки

- **close = новые записи нельзя, отмена можно** — разные вещи. Организатору важен финальный состав за 2ч, но игрок может отмениться (заболел) даже после close, если в пределах cancellationDeadlineHours (Phase 5).
- **Совмещён с reminder_2h** — один момент (startsAt−2ч), один handler. Сначала напоминание confirmed, потом close.
- **Идемпотентность через статус** — только published→closed. Уже closed/cancelled/finished → пропуск.
- **Если 5.3.2 проверяет published** — closed автоматически блокирует book (не published). Проверить что проверка именно на published, не на «не cancelled».

## Не делать

- ❌ Не блокировать отмену при closed (deadline Phase 5)
- ❌ Не закрывать cancelled/finished
- ❌ Не делать настраиваемый порог (фиксировано 2ч)
