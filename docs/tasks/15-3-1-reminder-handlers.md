---
id: '15.3.1'
phase: '15'
epic: '15.3'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - BACK
depends_on:
  - '15.1.2'
  - '15.2.1'
  - '8.4.2'
estimated_hours: '2'
tags:
  - scheduler
  - reminders
  - notifier
---

# Task 15.3.1: reminder handlers (24h, 2h) + шаблоны

## Цель

Обработчики reminder_24h и reminder_2h: загрузить событие + confirmed-брони, разослать напоминания через notifier. Шаблоны сообщений.

## Контекст

Решение 3: 24ч + 2ч, только confirmed. Handler в bot (worker). Загружает confirmed игроков, шлёт каждому. reminder_2h также триггерит auto-close (15.4.1, в том же handler).

## Что должно быть сделано

1. **Handler `apps/bot/src/jobs/handlers/reminders.ts`:**

   ```ts
   import { defineJob } from '../define'
   import { JOB_TYPES, type EventJobPayload } from '../types'
   import { db, events, bookings } from '@volley-time/db'
   import { eq, and } from 'drizzle-orm'
   import { notifierService } from '...' // notifier (8.4)

   async function sendReminders(eventId: number, kind: '24h' | '2h') {
     const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
     if (!event || event.status === 'cancelled') return // актуальность

     const confirmed = await db.query.bookings.findMany({
       where: and(eq(bookings.eventId, eventId), eq(bookings.status, 'confirmed')),
     })

     const type = kind === '24h' ? 'reminder_24h' : 'reminder_2h'
     for (const b of confirmed) {
       await notifierService.send(b.userId, type, {
         eventTitle: event.title,
         eventDate: formatEventDateForNotify(event.startsAt),
         orgId: event.organizationId,
         eventId: event.id,
       })
     }
   }

   export const reminder24hJob = defineJob<EventJobPayload>(
     JOB_TYPES.EVENT_REMINDER_24H,
     async ({ eventId }) => {
       await sendReminders(eventId, '24h')
     },
   )

   export const reminder2hJob = defineJob<EventJobPayload>(
     JOB_TYPES.EVENT_REMINDER_2H,
     async ({ eventId }) => {
       await sendReminders(eventId, '2h')
       // auto-close — в 15.4.1 (тот же момент, расширим этот handler)
     },
   )
   ```

2. **Шаблоны (расширить notifier templates 8.4.2):**

   ```ts
   case 'reminder_24h':
     return {
       text: `🏐 Напоминание: завтра тренировка\n<b>${esc(p.eventTitle)}</b>\n📅 ${p.eventDate}`,
       keyboard: [[{ text: 'Открыть событие', webAppUrl: miniAppUrl(`/m/orgs/${p.orgId}/events/${p.eventId}`) }]],
     }
   case 'reminder_2h':
     return {
       text: `⏰ Через 2 часа: <b>${esc(p.eventTitle)}</b>\n📅 ${p.eventDate}\n\nДо встречи!`,
       keyboard: [[{ text: 'Открыть событие', webAppUrl: miniAppUrl(`/m/orgs/${p.orgId}/events/${p.eventId}`) }]],
     }
   ```

3. **Только confirmed** — waitlisted/pending/cancelled не напоминаем.

4. **Проверка актуальности** — событие cancelled → пропуск (двойная защита с 15.2.2).

5. **Регистрация в реестре (15.1.2)** — reminder24hJob, reminder2hJob.

## Критерии приёмки

- ✅ reminder_24h handler: confirmed → напоминание «завтра»
- ✅ reminder_2h handler: confirmed → «через 2 часа»
- ✅ Только confirmed (не waitlist/pending/cancelled)
- ✅ Событие cancelled → пропуск
- ✅ Шаблоны reminder_24h/2h (notifier 8.4.2) с кнопкой открыть
- ✅ Зарегистрированы в реестре (15.1.2)
- ✅ idempotency — в 15.3.2

## Подсказки

- **Handler в bot** — worker там, notifier-отправка через bot Telegram API напрямую (или через notifierService).
- **Только confirmed** — waitlisted ещё не в составе (им незачем напоминание о тренировке, на которую не попали). pending — спорно, но решение 3 = confirmed.
- **reminder_2h + auto-close** — один момент времени. 15.4.1 расширит этот handler закрытием записи.
- **Актуальность** — между регистрацией и срабатыванием событие могло отмениться. Проверка обязательна.

## Не делать

- ❌ Не слать waitlist/pending/cancelled
- ❌ Не слать для отменённого события
- ❌ Не делать idempotency здесь (15.3.2)
