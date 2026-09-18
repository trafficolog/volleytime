---
id: '15.4.2'
phase: '15'
epic: '15.4'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - BACK
depends_on:
  - '15.2.1'
  - '5.2.2'
estimated_hours: '1'
tags:
  - scheduler
  - events
  - auto-finish
---

# Task 15.4.2: Auto-finished handler

## Цель

Обработчик auto_finish: через 30 мин после окончания события (endsAt+30мин) перевести closed/published → finished. Прошедшие события не висят в активных.

## Контекст

Решение 8: auto-finished для истории/отчётности. Через 30 мин после endsAt (буфер на случай задержки события). finished = событие в прошлом, для отчётов (Phase 14).

## Что должно быть сделано

1. **Handler `apps/bot/src/jobs/handlers/auto-finish.ts`:**

   ```ts
   import { defineJob } from '../define'
   import { JOB_TYPES, type EventJobPayload } from '../types'
   import { db, events } from '@volley-time/db'
   import { eq } from 'drizzle-orm'

   export const autoFinishJob = defineJob<EventJobPayload>(
     JOB_TYPES.EVENT_AUTO_FINISH,
     async ({ eventId }) => {
       const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
       if (!event) return
       // published/closed → finished; cancelled/finished → пропуск
       if (event.status === 'published' || event.status === 'closed') {
         await db
           .update(events)
           .set({ status: 'finished', updatedAt: new Date() })
           .where(eq(events.id, eventId))
       }
     },
   )
   ```

2. **Регистрация в реестре (15.1.2).**

3. **Статус finished** — уже есть в event status enum (Phase 5, 5.2.1: draft/published/closed/finished/cancelled). Миграция НЕ нужна, используем существующий.

4. **Связь с attendance (5.10.3):** после finished организатор всё ещё может отметить посещаемость (finished не блокирует attendance — это пост-фактум). Или attendance до finished. Уточнить: finished не мешает attendance-отметкам (они про прошедшее событие).

5. **Idempotent** — уже finished/cancelled → no-op.

6. **Тесты:**
   ```ts
   test('auto_finish: closed → finished', async () => {})
   test('auto_finish: published → finished', async () => {})
   test('auto_finish: cancelled → stays cancelled (no-op)', async () => {})
   test('auto_finish: already finished → no-op', async () => {})
   ```

## Критерии приёмки

- ✅ auto_finish handler: published/closed → finished
- ✅ cancelled/finished → пропуск (idempotent)
- ✅ Срабатывает endsAt+30мин
- ✅ finished используется из существующего enum (5.2.1, миграция не нужна)
- ✅ finished не блокирует attendance (пост-отметки)
- ✅ Зарегистрирован в реестре
- ✅ Тесты

## Подсказки

- **30 мин буфер** — событие могло начаться/закончиться с задержкой. +30мин после endsAt безопасно (точно закончилось).
- **finished для отчётов** — Phase 14 (reports) будет фильтровать finished события. Чистое разделение активное/прошедшее.
- **attendance после finished** — организатор отмечает кто был уже постфактум. finished не должен блокировать attendance-сервис. Проверить взаимодействие с 5.10.3.
- **cancelled остаётся cancelled** — отменённое не становится finished (оно не состоялось).

## Не делать

- ❌ Не переводить cancelled в finished
- ❌ Не блокировать attendance при finished
- ❌ Не финишить раньше endsAt+30мин
