---
id: '8.5.3'
phase: '8'
epic: '8.5'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 8.8 подтверждены кодом и review evidence; manual Telegram gate вынесен в 8.7.2/8.8.11.'
roles:
  - BACK
depends_on:
  - '8.5.1'
  - '5.6.2'
  - '6.4.1'
estimated_hours: '1-2'
tags:
  - notifier
  - events
  - waitlist
---

# Task 8.5.3: Event cancelled (mass) + promotion уведомления

## Цель

Подключить уведомления: waitlist promotion → продвинутому игроку (КРИТИЧНО), event cancelled → всем участникам (после mass refund).

## Контекст

Точки: promotion в 5.6.2 (одиночная отмена → продвижение), mass cancel в 6.4.1 (отмена события → всем). Promotion особенно важен: игрок не следит за листом ожидания вручную, уведомление — единственный способ узнать что попал в состав.

## Что должно быть сделано

1. **waitlist promotion (5.6.2)** — продвинутому игроку:

   ```ts
   // promoteFromWaitlist возвращает promoted booking
   // вызывается из cancel (5.6.1) и mass refund — но НЕ из mass (там событие отменяется)
   // собрать notification для promoted:
   if (promoted) {
     notifications.push({
       userId: promoted.userId,
       type: 'waitlist_promoted',
       payload: {
         eventTitle: event.title,
         eventDate: formatEventDateForNotify(event.startsAt),
         orgId: event.organizationId,
         eventId: event.id,
         needsPayment: promoted.status === 'pending_payment',
       },
     })
   }
   ```

   bookingService.cancel (5.6.1) возвращает { booking, promoted, notifications }. Endpoint (5.7.1 delete) dispatch'ит.

2. **event cancelled mass (6.4.1)** — всем участникам:

   ```ts
   // eventService.cancel (mass refund) собирает уведомления для всех затронутых
   // ВНУТРИ транзакции собираем userIds + refund-флаги, ПОСЛЕ коммита шлём
   const notifications: PendingNotification[] = []
   // в цикле по activeBookings (внутри транзакции) — копим:
   //   { userId: b.userId, refunded: (был succeeded payment или subscription) }
   // после коммита транзакции:
   for (const { userId, refunded } of affectedUsers) {
     notifications.push({
       userId,
       type: 'event_cancelled',
       payload: {
         eventTitle: event.title,
         eventDate: formatEventDateForNotify(event.startsAt),
         refunded,
       },
     })
   }
   return { event: cancelled, notifications }
   ```

   eventService.cancel возвращает { event, notifications }. Endpoint (5.2.4 cancel) dispatch'ит.

3. **Обновить сигнатуры:**
   - bookingService.cancel → { booking, promoted, notifications }
   - eventService.cancel → { event, notifications }
   - Endpoints обновить (dispatch после)

4. **Дедупликация:** при mass cancel игрок мог иметь и booking, и быть в waitlist — одно уведомление на пользователя (event_cancelled). Собирать уникальные userIds.

5. **Тесты:**
   ```ts
   test('promotion → promoted player gets waitlist_promoted', async () => {})
   test('promoted to pending_payment → needsPayment true in notification', async () => {})
   test('mass cancel → all participants get event_cancelled', async () => {})
   test('mass cancel → refunded flag set for paid/subscription bookings', async () => {})
   test('participant in multiple states → single event_cancelled notification', async () => {})
   test('promotion notifications sent after commit', async () => {})
   ```

## Критерии приёмки

- ✅ waitlist promotion → продвинутому игроку (waitlist_promoted)
- ✅ promoted в pending_payment → needsPayment=true (напоминание оплатить)
- ✅ event cancelled → всем участникам (включая waitlist)
- ✅ refunded флаг: true если был succeeded payment или subscription (восстановлено)
- ✅ Дедупликация: один event_cancelled на пользователя
- ✅ Сигнатуры cancel обновлены (возвращают notifications)
- ✅ Все после коммита
- ✅ Тесты

## Подсказки

- **Promotion notification — самое ценное в Phase 8.** Игрок записался в лист ожидания, забыл, через день освободилось место — он автоматически в составе и СРАЗУ узнаёт. Без этого waitlist бесполезен.
- **Mass cancel: собирать в транзакции, слать после.** userIds известны внутри (цикл по броням), но send — после коммита. Накопить в массив, dispatch после.
- **refunded флаг** для текста: «оплата возвращена / занятие восстановлено» — игрок знает что деньги/сессия вернулись.
- **Дедуп** — Set по userId, иначе игрок с booking+waitlist получит два уведомления.

## Не делать

- ❌ Не слать promotion при mass cancel (там событие отменяется, promotion не запускается — см. 6.4.1)
- ❌ Не дублировать уведомления одному игроку
- ❌ Не слать внутри транзакции
- ❌ Reminders — Phase 15
