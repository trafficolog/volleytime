---
id: '15.7.1'
phase: '15'
epic: '15.7'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: 'notify.deliver job с retry. Закрывает fire-and-forget долг Phase 8.'
roles:
  - BACK
depends_on:
  - '15.1.1'
  - '8.4.1'
estimated_hours: '2'
tags:
  - notifier
  - queue
  - retry
---

# Task 15.7.1: notify.deliver job + retry + sendReliable

## Цель

Job notify.deliver: доставка уведомления через pg-boss с retry (3 попытки, backoff). notifierService.sendReliable (через очередь) рядом с send (прямой). Dead-letter лог при исчерпании.

## Контекст

Решение 7: Phase 8 notifier — fire-and-forget (упал Telegram → потеряно). Job runner позволяет retry. Критичные уведомления → sendReliable (очередь), некритичные → send (прямой).

## Что должно быть сделано

1. **notify.deliver handler `apps/bot/src/jobs/handlers/notify-deliver.ts`:**

   ```ts
   export const notifyDeliverJob = defineJob<NotifyDeliverPayload>(
     JOB_TYPES.NOTIFY_DELIVER,
     async ({ userId, type, data }) => {
       // фактическая отправка (резолв telegram_id, рендер, send через bot)
       // throw при сбое → pg-boss retry (retryLimit 3)
       await deliverNotification(userId, type, data)
       // если все попытки исчерпаны — pg-boss переведёт в failed (dead-letter лог)
     },
   )
   ```

   retryLimit/backoff из pg-boss конфига (15.1.1). throw → повтор.

2. **sendReliable в notifierService (web, расширение 8.4):**

   ```ts
   /**
    * Надёжная доставка через очередь (retry). Для критичных уведомлений.
    * Ставит notify.deliver job (pg-boss send из web).
    */
   async sendReliable(userId: number, type: NotificationType, data: Record<string, unknown>) {
     // вместо прямого transport — enqueue job
     await enqueue(JOB_TYPES.NOTIFY_DELIVER, { userId, type, data })
     // job обработается worker (bot) с retry
   }
   ```

   send (прямой, 8.4) остаётся для некритичных.

3. **deliverNotification** — общая логика доставки (резолв telegram_id, рендер шаблона, отправка). Используется и в notify.deliver job, и опц в прямом send. Вынести из 8.4 transport.

4. **Dead-letter** — после исчерпания retry pg-boss помечает job failed. Лог (Sentry 9.6) что уведомление не доставлено после 3 попыток. Не молча терять.

5. **Idempotency доставки** — retry может доставить дважды если первая попытка прошла, но ответ потерялся. Приемлемо для уведомлений (дубль лучше потери) ИЛИ dedup-ключ (сложнее). Для MVP — дубль приемлем, отметить.

6. **Тесты:**
   ```ts
   test('sendReliable enqueues notify.deliver job', async () => {})
   test('notify.deliver delivers notification', async () => {})
   test('delivery failure → retry (up to 3)', async () => {})
   test('exhausted retries → failed + logged', async () => {})
   ```

## Критерии приёмки

- ✅ notify.deliver job (доставка с retry через pg-boss)
- ✅ sendReliable (через очередь) рядом с send (прямой)
- ✅ retry 3 попытки + backoff (pg-boss конфиг)
- ✅ Исчерпание → failed + лог (Sentry), не молча
- ✅ deliverNotification общая логика
- ✅ Idempotency задокументирована (дубль приемлем)
- ✅ Тесты

## Подсказки

- **sendReliable vs send** — критичные (от которых зависит участие/деньги) через очередь. Мелкие (booking_confirmed) можно прямо (потеря не критична). Не всё через очередь — баланс.
- **throw → retry** — pg-boss повторяет при исключении handler. Telegram timeout → throw → повтор через backoff.
- **Dead-letter не молчать** — после 3 попыток уведомление потеряно, но это должно быть видно (Sentry). Иначе тихая потеря критичного.
- **Дубль vs потеря** — для уведомлений дубль (получил дважды) лучше потери. Idempotency-ключ можно добавить позже, для MVP дубль приемлем.

## Не делать

- ❌ Не переводить ВСЕ уведомления на очередь (только критичные)
- ❌ Не терять молча после retry (лог)
- ❌ Не блокировать бизнес-операцию (по-прежнему после коммита)
