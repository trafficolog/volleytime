---
id: '15.1.1'
phase: '15'
epic: '15.1'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - BACK
depends_on:
  - '9.1.2'
estimated_hours: '2'
tags:
  - pg-boss
  - scheduler
  - infra
---

# Task 15.1.1: pg-boss подключение + обёртка (defineJob, schedule, enqueue)

## Цель

Подключить pg-boss к PostgreSQL. Типобезопасная обёртка: defineJob (тип + handler), schedule (отложенная задача на дату), enqueue (немедленная). Job types enum.

## Контекст

Решение 1: pg-boss (очередь на Postgres, без Redis). Держит очередь в схеме `pgboss` той же БД (Phase 9). Обёртка даёт типобезопасность и единообразие постановки задач.

## Что должно быть сделано

1. **Установка:**

   ```bash
   pnpm -F @volley-time/bot add pg-boss
   # pg-boss создаёт свою схему в той же БД (DATABASE_URL)
   ```

2. **Job types `apps/bot/src/jobs/types.ts`:**

   ```ts
   export const JOB_TYPES = {
     EVENT_REMINDER_24H: 'event.reminder_24h',
     EVENT_REMINDER_2H: 'event.reminder_2h',
     EVENT_AUTO_FINISH: 'event.auto_finish',
     BOOKING_PENDING_TTL: 'booking.pending_ttl',
     WAITLIST_OFFER_TTL: 'waitlist.offer_ttl',
     NOTIFY_DELIVER: 'notify.deliver',
   } as const

   export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES]

   // payload типы
   export interface EventJobPayload {
     eventId: number
   }
   export interface BookingTtlPayload {
     bookingId: number
   }
   export interface WaitlistOfferPayload {
     eventId: number
     bookingId: number
   }
   export interface NotifyDeliverPayload {
     userId: number
     type: string
     data: Record<string, unknown>
   }
   ```

3. **pg-boss обёртка `apps/bot/src/jobs/boss.ts`:**

   ```ts
   import PgBoss from 'pg-boss'
   import { env } from '../env'

   let boss: PgBoss | null = null

   export async function getBoss(): Promise<PgBoss> {
     if (boss) return boss
     boss = new PgBoss({
       connectionString: env.DATABASE_URL,
       // schema: 'pgboss' по умолчанию
       retryLimit: 3,
       retryBackoff: true,
     })
     await boss.start()
     return boss
   }

   /**
    * Запланировать задачу на конкретную дату (startAfter).
    * jobKey (singletonKey) — для дедупликации/отмены.
    */
   export async function schedule(
     type: string,
     payload: object,
     runAt: Date,
     jobKey?: string,
   ): Promise<string | null> {
     const b = await getBoss()
     return b.send(type, payload, {
       startAfter: runAt,
       singletonKey: jobKey, // дедупликация: один job на ключ
     })
   }

   /**
    * Немедленная задача (с retry из конфига).
    */
   export async function enqueue(
     type: string,
     payload: object,
     jobKey?: string,
   ): Promise<string | null> {
     const b = await getBoss()
     return b.send(type, payload, { singletonKey: jobKey })
   }

   /**
    * Отменить задачи по singletonKey (при отмене события).
    */
   export async function cancelByKey(jobKey: string): Promise<void> {
     const b = await getBoss()
     // pg-boss: отмена через deleteQueue/cancel по id; для singletonKey —
     // хранить соответствие key→jobId или использовать cancel API.
     // Вариант: pg-boss поддерживает cancel(jobId). Для отмены по событию
     // храним jobIds в БД (15.2) либо используем deleteJob по фильтру.
   }

   export async function stopBoss(): Promise<void> {
     if (boss) {
       await boss.stop()
       boss = null
     }
   }
   ```

4. **defineJob (регистрация обработчика) `apps/bot/src/jobs/define.ts`:**

   ```ts
   import { getBoss } from './boss'

   export function defineJob<T extends object>(
     type: string,
     handler: (payload: T) => Promise<void>,
   ) {
     return {
       type,
       async register() {
         const b = await getBoss()
         await b.work(type, async (job) => {
           await handler(job.data as T)
           // успешное завершение — pg-boss помечает done
           // ошибка (throw) — pg-boss retry по retryLimit
         })
       },
     }
   }
   ```

5. **Отмена задач — стратегия:** pg-boss `cancel(id)` отменяет по jobId. Для отмены «всех задач события» — хранить jobIds в БД (event_jobs table в 15.2) или использовать singletonKey + pg-boss delete. Уточнить в 15.2 (там lifecycle). Здесь — заложить cancelByKey/cancel(id).

## Критерии приёмки

- ✅ pg-boss подключён (та же БД, схема pgboss), start()
- ✅ JOB_TYPES enum + payload типы
- ✅ schedule (отложенная на дату, singletonKey)
- ✅ enqueue (немедленная)
- ✅ defineJob (типобезопасная регистрация handler)
- ✅ retry конфиг (retryLimit 3, backoff)
- ✅ stopBoss (graceful)
- ✅ Стратегия отмены задач заложена (для 15.2)

## Подсказки

- **pg-boss создаёт схему сам** — при start() в БД появляется схема pgboss с таблицами job. Та же БД (DATABASE_URL), отдельная схема — не мешает основным таблицам.
- **singletonKey для дедупликации** — `event-{id}-reminder24h` гарантирует один job на событие+тип. Повторная регистрация не дублирует.
- **Отмена задач** — pg-boss не отменяет по singletonKey напрямую легко. Практичнее хранить jobId в БД (event_jobs, 15.2) и cancel(jobId). Или проверять актуальность в handler (событие отменено → пропуск) — проще, idempotency покрывает.
- **retry встроен** — throw в handler → pg-boss повторит (retryLimit 3). Удобно для notify (15.7).

## Не делать

- ❌ Не использовать Redis/BullMQ
- ❌ Не создавать отдельную БД для очереди (та же, схема pgboss)
- ❌ Не блокировать старт bot если pg-boss недоступен (graceful, лог)
