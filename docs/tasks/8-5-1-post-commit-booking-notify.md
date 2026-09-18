---
id: '8.5.1'
phase: '8'
epic: '8.5'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11."
roles:
  - BACK
depends_on:
  - '8.4.2'
  - '5.3.2'
estimated_hours: '2-3'
tags:
  - notifier
  - bookings
  - architecture
---

# Task 8.5.1: Паттерн post-commit notify + booking уведомления

## Цель

Установить паттерн «collect-then-notify» (собрать уведомления в транзакции, послать после коммита). Подключить booking уведомления: confirmed, waitlisted.

## Контекст

Решение 7: fire-and-forget после коммита. Нельзя слать notifier внутри db.transaction — медленный/упавший telegram заблокирует или (хуже) откатит бизнес-операцию через timeout.

Паттерн: сервис возвращает результат + `pendingNotifications` (что послать). Endpoint/обёртка после успешного коммита вызывает notifier. Либо сервисный метод оборачивает транзакцию и шлёт после.

## Что должно быть сделано

1. **Паттерн — выбрать подход.** Рекомендуемый: сервисные методы возвращают `{ result, notifications }`, где notifications — массив `{ userId, type, payload }`. Вызывающий код (endpoint) после получения результата шлёт их. Транзакция уже закоммичена к моменту возврата.

   ```ts
   // тип
   interface PendingNotification {
     userId: number
     type: NotificationType
     payload: Record<string, unknown>
   }
   ```

2. **Хелпер `apps/web/modules/notifier/dispatch.ts`:**

   ```ts
   import { notifierService } from './service'
   import type { PendingNotification } from './types'

   /**
    * Отправить собранные уведомления. Fire-and-forget.
    * Вызывать ПОСЛЕ коммита (вне транзакции).
    */
   export async function dispatchNotifications(
     notifications: PendingNotification[],
   ): Promise<void> {
     await Promise.allSettled(
       notifications.map((n) => notifierService.send(n.userId, n.type, n.payload)),
     )
   }
   ```

3. **Обновить bookingService.book (5.3.2)** — собирать notifications, возвращать:

   ```ts
   async book(ctx, orgId, eventId, input): Promise<{ booking: Booking; notifications: PendingNotification[] }> {
     const notifications: PendingNotification[] = []
     const booking = await db.transaction(async (tx) => {
       // ... вся логика book ...
       // в конце, зная статус:
       return created
     })

     // ПОСЛЕ коммита — собираем уведомления (event уже загружен в транзакции, сохранить в замыкании)
     if (booking.status === 'confirmed') {
       notifications.push({ userId: ctx.userId, type: 'booking_confirmed', payload: {
         eventTitle: event.title, eventDate: formatEventDateForNotify(event.startsAt),
         orgId, eventId,
       }})
     } else if (booking.status === 'waitlisted') {
       notifications.push({ userId: ctx.userId, type: 'booking_waitlisted', payload: {
         eventTitle: event.title, eventDate: formatEventDateForNotify(event.startsAt), orgId, eventId,
       }})
     }
     return { booking, notifications }
   }
   ```

   ВАЖНО: сигнатура book меняется ({ booking, notifications }). Обновить вызовы (endpoint 5.7.1, promotion 5.6.2 если использует).

4. **Обновить endpoint book (5.7.1):**

   ```ts
   const { booking, notifications } = await bookingService.book(ctx, orgId, eventId, body)
   // dispatch после получения результата (транзакция закоммичена)
   dispatchNotifications(notifications) // не await — fire-and-forget, или await для гарантии лога
   return { booking }
   ```

5. **Альтернатива (если менять сигнатуры дорого):** notifier-вызовы прямо в endpoint после успешного сервисного вызова, endpoint сам знает результат (booking.status) и шлёт. Проще, но дублирует логику «что слать» по endpoints. Для MVP допустимо. Выбрать прагматично — задокументировать выбор.

6. **Тесты:**
   ```ts
   test('book confirmed returns booking_confirmed notification', async () => {})
   test('book waitlisted returns booking_waitlisted notification', async () => {})
   test('notifications not sent inside transaction (sent after)', async () => {})
   test('dispatch failure does not affect booking result', async () => {})
   ```

## Критерии приёмки

- ✅ Паттерн collect-then-notify установлен (PendingNotification, dispatchNotifications)
- ✅ bookingService.book возвращает { booking, notifications }
- ✅ confirmed → booking_confirmed notification
- ✅ waitlisted → booking_waitlisted notification
- ✅ Уведомления шлются ПОСЛЕ коммита (не внутри транзакции)
- ✅ Dispatch fire-and-forget (сбой не влияет на booking)
- ✅ Endpoint book обновлён
- ✅ Тесты подтверждают post-commit + изоляцию

## Подсказки

- **Главное — НЕ внутри транзакции.** Паттерн collect-then-notify решает это чисто: транзакция возвращает данные, уведомления собраны, шлём после. Альтернатива (notifier в endpoint) тоже после коммита, но логика «что слать» расползается.
- **event в замыкании:** book загружает event внутри транзакции; сохранить ссылку для payload после коммита (данные уже прочитаны).
- **dispatchNotifications без await** — не блокирует ответ. С await — гарантирует попытку (и лог) до ответа, но чуть медленнее. Для MVP без await (быстрый ответ), notifier сам fire-and-forget.
- **Изменение сигнатуры book** затронет вызовы — обновить endpoint и promotion (5.6.2). Если дорого — прагматичный вариант (notifier в endpoint).

## Не делать

- ❌ Не слать внутри db.transaction
- ❌ Не блокировать ответ доставкой
- ❌ Не откатывать booking при сбое notifier
