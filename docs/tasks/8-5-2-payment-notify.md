---
id: '8.5.2'
phase: '8'
epic: '8.5'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 8.8.'
roles:
  - BACK
depends_on:
  - '8.5.1'
  - '6.1.3'
  - '6.1.4'
estimated_hours: '2'
tags:
  - notifier
  - payments
---

# Task 8.5.2: Payment уведомления (confirmed/rejected/pending→organizer)

## Цель

Подключить уведомления к payment flow: confirmed → игроку, rejected → игроку, pending payment created → организаторам (новая бронь ждёт подтверждения).

## Контекст

Точки в 6.1.3 (confirm), 6.1.4 (cancel/reject), 6.3.1 (cash booking создаёт pending → уведомить организатора). Все после коммита, паттерн из 8.5.1.

## Что должно быть сделано

1. **payment confirmed (6.1.3)** — игроку после confirm:

   ```ts
   // paymentService.confirm возвращает { payment, notifications }
   // после коммита:
   notifications.push({
     userId: payment.userId,
     type: 'payment_confirmed',
     payload: {
       subject: payment.bookingId ? 'участие в событии' : 'абонемент',
       amount: formatPriceForNotify(payment.amount, payment.currency),
     },
   })
   ```

2. **payment rejected (6.1.4 cancel)** — игроку:

   ```ts
   notifications.push({
     userId: payment.userId,
     type: 'payment_rejected',
     payload: {
       subject: payment.bookingId ? 'участие в событии' : 'абонемент',
     },
   })
   ```

3. **pending payment created → организаторам (6.3.1)** — после cash/transfer booking:

   ```ts
   // когда booking создаёт pending payment, уведомить организаторов org
   // нужны userIds организаторов (owner + organizer роли)
   const organizers = await memberService.listManagers(ctx, orgId) // owner/organizer
   for (const org of organizers) {
     notifications.push({
       userId: org.userId,
       type: 'pending_payment_for_organizer',
       payload: {
         playerName: playerName,
         eventTitle: event.title,
         amount: formatPriceForNotify(payment.amount, payment.currency),
         method: methodLabelRu(payment.method),
         orgId,
       },
     })
   }
   ```

   Потребуется memberService.listManagers (owner+organizer active) — добавить если нет.

4. **listManagers helper (members module)** если отсутствует:

   ```ts
   async listManagers(ctx, orgId): Promise<OrganizationMember[]> {
     return db.query.organizationMembers.findMany({
       where: and(eq(organizationMembers.organizationId, orgId),
                  inArray(organizationMembers.role, ['owner', 'organizer']),
                  eq(organizationMembers.status, 'active')),
     })
   }
   ```

5. **Endpoints (6.5.2 confirm/cancel)** — dispatch notifications после сервисного вызова.

6. **Тесты:**
   ```ts
   test('confirm → player gets payment_confirmed', async () => {})
   test('reject → player gets payment_rejected', async () => {})
   test('cash booking → organizers get pending_payment notification', async () => {})
   test('multiple organizers all notified', async () => {})
   ```

## Критерии приёмки

- ✅ payment confirmed → игроку (payment_confirmed)
- ✅ payment rejected → игроку (payment_rejected)
- ✅ pending payment (cash/transfer booking) → всем организаторам org
- ✅ listManagers возвращает owner+organizer active
- ✅ Несколько организаторов — все уведомлены
- ✅ Все после коммита, fire-and-forget
- ✅ Тесты

## Подсказки

- **pending→organizer важно** — организатор должен знать, что есть что подтверждать (иначе игрок ждёт впустую). Альтернатива/дополнение — badge в dashboard (6.5.2) уже есть; уведомление активнее.
- **listManagers** — owner + organizer (те, кто может confirm). Не слать игрокам/assistant (пока assistant не активен).
- **methodLabelRu** — «Наличные»/«Перевод» (из labels или локально).

## Не делать

- ❌ Не уведомлять игроков о чужих платежах
- ❌ Не слать внутри транзакции
- ❌ Не спамить (одно уведомление на событие создания pending)
