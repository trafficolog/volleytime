---
id: '15.3.2'
phase: '15'
epic: '15.3'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - BACK
depends_on:
  - '15.3.1'
estimated_hours: '1-2'
tags:
  - scheduler
  - reminders
  - idempotency
---

# Task 15.3.2: Idempotency (отметка отправки) + проверка актуальности

## Цель

Гарантировать, что напоминание не отправляется дважды (retry задачи, повторный запуск). Отметка отправки на booking или event. Проверка актуальности (статус брони мог измениться).

## Контекст

pg-boss может повторить задачу (retry при сбое, at-least-once). Без idempotency игрок получит дубль напоминания. Отмечаем факт отправки, повтор пропускаем.

## Что должно быть сделано

1. **Отметка отправки** — варианты:
   - (A) Поле на booking: reminder24hSentAt, reminder2hSentAt
   - (B) Отдельная таблица sent_reminders (eventId, userId, kind)
   - (C) Флаг на event (eventReminder24hSent) — но напоминание per-booking, не per-event

   Выбрать **A** (поля на booking) — гранулярно, переживает изменения состава:

   ```ts
   // bookings schema (расширить 5.3.1):
   reminder24hSentAt: timestamp('reminder_24h_sent_at', { withTimezone: true }),
   reminder2hSentAt: timestamp('reminder_2h_sent_at', { withTimezone: true }),
   ```

2. **Проверка + отметка в handler (расширить 15.3.1 sendReminders):**

   ```ts
   for (const b of confirmed) {
     const sentField = kind === '24h' ? 'reminder24hSentAt' : 'reminder2hSentAt'
     if (b[sentField]) continue  // уже отправлено — пропуск (idempotency)

     await notifierService.send(b.userId, type, { ... })

     // отметить отправку
     await db.update(bookings).set({ [sentField]: new Date() }).where(eq(bookings.id, b.id))
   }
   ```

3. **Проверка актуальности брони** — между планированием и отправкой бронь могла стать cancelled (игрок отменился). Загружаем confirmed на момент выполнения (15.3.1 уже фильтрует confirmed) — отменённые не попадут. Дополнительно: если игрок отменился после 24h-напоминания, 2h-напоминание не придёт (он уже не confirmed). Корректно.

4. **Retry-safe:** если задача упала после отправки части игроков (notifier сбой) и повторилась — уже отмеченные пропускаются, продолжаем с неотмеченных. Частичная доставка не дублирует.

5. **Тесты:**
   ```ts
   test('reminder sent once even if job runs twice', async () => {})
   test('reminder24hSentAt set after send', async () => {})
   test('player cancelled after 24h → no 2h reminder', async () => {})
   test('retry after partial send → only unsent get reminder', async () => {})
   ```

## Критерии приёмки

- ✅ Поля reminder24hSentAt/reminder2hSentAt на booking
- ✅ Handler проверяет флаг → пропуск если отправлено
- ✅ Отметка после успешной отправки
- ✅ Повторный запуск задачи → не дублирует
- ✅ Retry после частичной доставки → только неотправленные
- ✅ Отменившийся игрок → не получает следующее напоминание (фильтр confirmed)
- ✅ Тесты

## Подсказки

- **Per-booking отметка (вариант A)** — гранулярно. Состав меняется (отмены, promotion), флаг на booking корректно отслеживает кому отправлено.
- **At-least-once pg-boss** — задача может выполниться >1 раза (retry). Idempotency обязательна, иначе дубли.
- **Частичный сбой** — notifier упал на 3-м игроке из 10, задача retry → первые 2 отмечены, пропускаются, продолжаем с 3-го. Без дублей первым двум.
- **2h после отмены** — игрок отменился между 24h и 2h → не в confirmed → 2h не придёт. Естественно через фильтр.

## Не делать

- ❌ Не слать дважды (флаг)
- ❌ Не отмечать до успешной отправки (иначе пропустим при реальном сбое)
- ❌ Не использовать event-level флаг (per-booking)
