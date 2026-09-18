---
id: '15.2.1'
phase: '15'
epic: '15.2'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - BACK
depends_on:
  - '15.1.1'
  - '5.2.2'
estimated_hours: '1-2'
tags:
  - scheduler
  - events
  - lifecycle
---

# Task 15.2.1: Регистрация задач в eventService.create

## Цель

При создании Event регистрировать scheduled-задачи: reminder_24h (startsAt−24ч), reminder_2h (startsAt−2ч), auto_finish (endsAt+30мин). Хранить jobIds для последующей отмены.

## Контекст

Задачи привязаны ко времени события. eventService.create (5.2.2) после создания Event ставит задачи через schedule (15.1.1). Задачи в прошлом не регистрируются (короткое событие <24ч — только применимые).

## Что должно быть сделано

1. **Таблица связи задач с событием `packages/db/src/schema/event-jobs.ts`** (для отмены):

   ```ts
   import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core'
   import { events } from './events'

   export const eventJobs = pgTable('event_jobs', {
     id: serial('id').primaryKey(),
     eventId: integer('event_id')
       .notNull()
       .references(() => events.id, { onDelete: 'cascade' }),
     jobType: text('job_type').notNull(), // event.reminder_24h и т.д.
     jobId: text('job_id').notNull(), // pg-boss job id (для cancel)
     runAt: timestamp('run_at', { withTimezone: true }).notNull(),
     createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
   })
   ```

   Хранит соответствие event→jobId, чтобы отменить при cancel (15.2.2).

2. **Хелпер регистрации `apps/web/modules/events/jobs.ts`** (web ставит задачи, обрабатывает bot):

   ```ts
   import { schedule } from '...' // обёртка может быть общей или web вызывает через...
   // ВАЖНО: pg-boss обёртка в bot. web ставит задачи — нужен доступ к pg-boss из web.
   // Вариант: pg-boss send можно делать из web (та же БД), обработку — в bot.
   // pg-boss.send работает из любого процесса с доступом к БД. work (обработка) — в bot.
   // То есть web импортирует лёгкий send-клиент pg-boss (или общий пакет).

   import { JOB_TYPES } from '@volley-time/jobs' // общий пакет типов/обёртки

   export async function registerEventJobs(
     db,
     event: { id: number; startsAt: Date; endsAt: Date; organizationId: number },
   ) {
     const now = Date.now()
     const jobs: { type: string; runAt: Date }[] = []

     const reminder24h = new Date(event.startsAt.getTime() - 24 * 3600_000)
     const reminder2h = new Date(event.startsAt.getTime() - 2 * 3600_000)
     const autoFinish = new Date(event.endsAt.getTime() + 30 * 60_000)

     if (reminder24h.getTime() > now)
       jobs.push({ type: JOB_TYPES.EVENT_REMINDER_24H, runAt: reminder24h })
     if (reminder2h.getTime() > now)
       jobs.push({ type: JOB_TYPES.EVENT_REMINDER_2H, runAt: reminder2h })
     // auto_finish всегда в будущем (endsAt+30мин)
     jobs.push({ type: JOB_TYPES.EVENT_AUTO_FINISH, runAt: autoFinish })

     for (const j of jobs) {
       const jobKey = `event-${event.id}-${j.type}`
       const jobId = await schedule(j.type, { eventId: event.id }, j.runAt, jobKey)
       if (jobId) {
         await db.insert(eventJobs).values({
           eventId: event.id,
           jobType: j.type,
           jobId,
           runAt: j.runAt,
         })
       }
     }
   }
   ```

3. **Общий пакет pg-boss send** — `packages/jobs/` (типы JOB_TYPES + send/schedule клиент), чтобы и web, и bot использовали. pg-boss.send работает из любого процесса с БД-доступом; work (обработка) — только в bot. Вынести обёртку в общий пакет (15.1.1 boss.ts → packages/jobs).

4. **Вызов в eventService.create (5.2.2):**

   ```ts
   // после создания event (+ credit spend 7.3.1), в той же или после транзакции:
   await registerEventJobs(getDb(ctx), event)
   // задачи ставятся после успешного создания. Если в транзакции — pg-boss send
   // должен быть после коммита (как notifier), т.к. задача ссылается на event.id
   ```

   Ставить ПОСЛЕ коммита (задача обрабатывается асинхронно, событие должно существовать).

5. **Короткие события:** если событие <24ч/<2ч — соответствующие reminders не ставятся (runAt в прошлом). auto_finish всегда.

6. **Тесты:**
   ```ts
   test('create event registers 24h/2h/finish jobs', async () => {})
   test('event <24h away → no 24h reminder', async () => {})
   test('event <2h away → no 2h reminder', async () => {})
   test('jobIds stored in event_jobs', async () => {})
   test('jobKey deduplicates (singleton)', async () => {})
   ```

## Критерии приёмки

- ✅ event_jobs таблица (event→jobId связь)
- ✅ registerEventJobs: 24h/2h/finish с правильным runAt
- ✅ Задачи в прошлом не регистрируются (короткое событие)
- ✅ auto_finish всегда (endsAt+30мин)
- ✅ jobIds сохраняются (для отмены 15.2.2)
- ✅ jobKey дедупликация (singletonKey)
- ✅ Ставится после коммита создания
- ✅ Общий пакет packages/jobs (web ставит, bot обрабатывает)
- ✅ Тесты

## Подсказки

- **pg-boss send из web, work в bot** — send (постановка) работает из любого процесса с БД. work (обработка) — только bot (worker). Вынести send/schedule в общий пакет packages/jobs, work оставить в bot.
- **После коммита** — задача обрабатывается асинхронно (через время), событие должно быть в БД. Ставить после успешного create (как notifier).
- **event_jobs для отмены** — pg-boss не отменяет по событию легко, храним jobId. При cancel (15.2.2) — cancel по этим jobId.
- **Короткие события** — создал событие на «через час» → 24h/2h reminders в прошлом, не ставим. Только auto_finish.

## Не делать

- ❌ Не ставить задачи в прошлом
- ❌ Не ставить в транзакции до коммита (после)
- ❌ Не дублировать (jobKey/singletonKey)
- ❌ Не делать work (обработку) в web (только bot)
