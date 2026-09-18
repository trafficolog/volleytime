---
id: '15.2.2'
phase: '15'
epic: '15.2'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - BACK
depends_on:
  - '15.2.1'
  - '5.2.2'
estimated_hours: '1-2'
tags:
  - scheduler
  - events
  - lifecycle
---

# Task 15.2.2: Отмена/перерегистрация при cancel/update

## Цель

При отмене события снять все его задачи. При изменении startsAt/endsAt — перерегистрировать (старые снять, новые по новому времени). Idempotent.

## Контекст

Отменённое событие не должно слать напоминания. Изменённое время → задачи по новому. Используем event_jobs (15.2.1) для поиска jobId к отмене.

## Что должно быть сделано

1. **Отмена задач `events/jobs.ts`:**

   ```ts
   import { cancelJob } from '@volley-time/jobs' // pg-boss cancel(jobId)

   export async function cancelEventJobs(db, eventId: number) {
     const jobs = await db.query.eventJobs.findMany({ where: eq(eventJobs.eventId, eventId) })
     for (const j of jobs) {
       await cancelJob(j.jobId) // pg-boss cancel; если уже выполнен/не найден — игнор
     }
     await db.delete(eventJobs).where(eq(eventJobs.eventId, eventId))
   }
   ```

2. **Вызов в eventService.cancel (5.2.2 / 6.4.1):**

   ```ts
   // в cancel, после mass refund (6.4.1) + credit refund (7.3.2):
   await cancelEventJobs(getDb(ctx), eventId)
   // снимаем reminders/finish — отменённое событие не напоминает
   ```

3. **Перерегистрация при изменении времени (eventService.update):**

   ```ts
   // если startsAt/endsAt изменились:
   await cancelEventJobs(db, eventId) // снять старые
   await registerEventJobs(db, updatedEvent) // поставить по новому времени
   ```

4. **Idempotency:**
   - cancelJob уже выполненной/несуществующей задачи → игнор (не ошибка)
   - Повторная отмена события (уже cancelled) → event_jobs пуст, no-op

5. **Защита handler от устаревших задач:** даже если задача не отменилась (race), handler (15.3+) проверяет актуальность события (cancelled → пропуск). Двойная защита.

6. **Тесты:**
   ```ts
   test('cancel event cancels all its jobs', async () => {})
   test('cancelled event jobs removed from event_jobs', async () => {})
   test('update startsAt reschedules jobs', async () => {})
   test('cancel already-cancelled event → no-op', async () => {})
   test('cancelJob on executed job → ignored', async () => {})
   ```

## Критерии приёмки

- ✅ cancelEventJobs снимает все задачи события (pg-boss cancel + чистит event_jobs)
- ✅ eventService.cancel вызывает cancelEventJobs
- ✅ Изменение времени → перерегистрация (снять старые, поставить новые)
- ✅ Idempotent (повторная отмена, выполненная задача → игнор)
- ✅ Handler-защита (cancelled событие → пропуск даже если задача осталась)
- ✅ Тесты

## Подсказки

- **Двойная защита:** отмена задач (здесь) + проверка актуальности в handler (15.3+). Если cancel не успел/race — handler увидит cancelled событие и пропустит. Надёжно.
- **cancelJob идемпотентен** — pg-boss cancel выполненной задачи безвреден (игнор). Не падать.
- **event_jobs чистится** — после отмены связи не нужны. delete по eventId.
- **update перерегистрация** — только если время изменилось (startsAt/endsAt). Другие правки (название) задач не трогают.

## Не делать

- ❌ Не оставлять задачи отменённого события
- ❌ Не падать на cancel выполненной задачи
- ❌ Не полагаться только на отмену (handler тоже проверяет)
