---
id: '5.8.1'
phase: '5'
epic: '5.8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 5.13.'
roles:
  - QA
  - BACK
depends_on:
  - '5.3.2'
  - '5.5.3'
  - '5.7.1'
estimated_hours: '2-3'
tags:
  - tests
  - integration
  - bookings
  - subscriptions
---

# Task 5.8.1: Booking + subscription flow tests

## Цель

Integration-тесты основных flow записи и абонементов. Перенос сценариев из Python-прототипа (там было 25 тестов).

## Контекст

Главная защита корректности Phase 5. Эти тесты — фундамент доверия к ядру.

## Что должно быть сделано

1. **`apps/web/modules/bookings/__tests__/booking-flow.integration.test.ts`:**

   ```ts
   describe('booking flows (integration)', () => {
     // helpers: setupOrgWithOwner, addPlayer, createEvent({ capacity, price })

     test('book with available spot → confirmed', async () => {})
     test('book when capacity full → waitlisted', async () => {})
     test('double booking same user → AlreadyBookedError', async () => {})
     test('non-member cannot book', async () => {})
     test('book cancelled event → EventNotBookableError', async () => {})
     test('book not-published event → error', async () => {})
     test('book started event → error', async () => {})
     test('free event → method=free, confirmed without payment', async () => {})
     test('cash booking → pending_payment, slot occupied', async () => {})
     test('rebook after cancel → reactivation (same record)', async () => {})
   })
   ```

2. **`subscriptions/__tests__/booking-with-subscription.integration.test.ts`:**

   ```ts
   describe('booking with subscription', () => {
     test('book with subscription → atomic consume + confirmed', async () => {
       // sub total=5, book event → confirmed, sub.used=1, booking.subscriptionId set
     })
     test('FIFO: consumes earliest-expiring subscription', async () => {
       // 2 subs (expires 10d, 30d), book → 10d sub consumed
     })
     test('exhausted subscription not used', async () => {
       // sub used=total, book with subscription → NoActiveSubscriptionError
     })
     test('expired subscription not used', async () => {
       // sub expiresAt in past, book → NoActiveSubscriptionError
     })
     test('specific subscriptionId honored', async () => {
       // 2 subs, book with specific id → that one consumed
     })
     test('waitlisted booking does NOT consume session', async () => {
       // capacity full, book with subscription → waitlisted, sub.used unchanged
     })
   })
   ```

3. **Helpers** (`__tests__/helpers.ts`) — переиспользуемые фабрики:
   ```ts
   export async function setupOrgWithOwner(db) {
     /* user + org + owner member */
   }
   export async function addActivePlayer(db, orgId, email) {
     /* user + member */
   }
   export async function createEvent(db, orgId, overrides) {
     /* event */
   }
   export async function createActiveSubscription(db, orgId, userId, { total, validityDays }) {
     /* sub */
   }
   ```

## Критерии приёмки

- ✅ Booking flows: confirmed, waitlisted, double-booking, non-member, cancelled/unpublished/started event, free, cash, rebook
- ✅ Subscription: consume+confirmed, FIFO, exhausted skip, expired skip, specific id, waitlist no-consume
- ✅ Helpers переиспользуются (DRY)
- ✅ ~16 тестов, стабильны
- ✅ Каждый изолирован (truncate)

## Подсказки

- **waitlist no-consume** — критичный тест. Сессия списывается только при попадании в состав (confirmed/promotion), не в waitlist.
- **rebook reactivation** — повторная запись после отмены не создаёт дубль (unique constraint), обновляет existing.
- **Helpers важны** — без них тесты раздуются. Вынеси setup в helpers.ts.

## Не делать

- ❌ Не дублировать concurrency (5.8.3)
- ❌ Не дублировать cancel/promotion (5.8.2 / 5.6.3)
- ❌ Не делать HTTP E2E — Phase 9
