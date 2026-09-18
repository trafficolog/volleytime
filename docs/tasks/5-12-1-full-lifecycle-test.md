---
id: '5.12.1'
phase: '5'
epic: '5.12'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: 'Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 5.13 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет.'
roles:
  - QA
  - BACK
depends_on:
  - '5.7.1'
  - '5.7.2'
  - '5.6.2'
estimated_hours: '2'
tags:
  - tests
  - integration
  - lifecycle
---

# Task 5.12.1: Full lifecycle integration test (UI-flow через API)

## Цель

End-to-end тест полного пользовательского сценария Phase 5 через сервисы — имитация того, что делает UI. От создания события до отмены с промоушеном.

## Контекст

5.8.2 покрыл backend lifecycle на уровне сервисов. Эта задача — финальный «приёмочный» сценарий, проходящий через все слои в порядке реального использования UI: организатор создаёт → игроки покупают абонементы → записываются → организатор отмечает → отмены/промоушн. Проверяет что вся цепочка Phase 5 работает слаженно.

## Что должно быть сделано

1. **`apps/web/modules/__tests__/phase5-acceptance.integration.test.ts`:**

   ```ts
   import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
   import { createTestDb, createTestUser, type TestDb } from '@volley-time/db/test-utils'
   import { organizationService } from '~/modules/organizations'
   import { memberService } from '~/modules/members'
   import { venueService } from '~/modules/venues'
   import { eventService } from '~/modules/events'
   import { subscriptionPlanService } from '~/modules/subscription-plans'
   import { subscriptionService } from '~/modules/subscriptions'
   import { bookingService } from '~/modules/bookings'

   describe('Phase 5 acceptance: full lifecycle', () => {
     let testDb: TestDb

     beforeAll(async () => {
       testDb = await createTestDb()
     })
     afterAll(async () => {
       await testDb.close()
     })
     beforeEach(async () => {
       await testDb.truncate()
     })

     test('organizer creates event, players subscribe, book, attend, cancel+promote', async () => {
       const db = testDb.db
       // === SETUP: организация + участники ===
       const owner = await createTestUser(db, { email: 'owner@t.com' })
       const org = await organizationService.create(
         { userId: owner.id, db },
         { name: 'Volley Club' },
       )

       const p1 = await createTestUser(db, { email: 'p1@t.com' })
       const p2 = await createTestUser(db, { email: 'p2@t.com' })
       const p3 = await createTestUser(db, { email: 'p3@t.com' })
       for (const p of [p1, p2, p3]) {
         await memberService.addMember(
           { userId: owner.id, db },
           { organizationId: org.id, userId: p.id, role: 'player', status: 'active' },
         )
       }

       // === ОРГАНИЗАТОР: создаёт площадку, план, событие ===
       const venue = await venueService.create({ userId: owner.id, db }, org.id, {
         name: 'Главный зал',
         address: 'ул. Спортивная, 1',
       })

       const plan = await subscriptionPlanService.create({ userId: owner.id, db }, org.id, {
         name: '8 занятий',
         totalSessions: 8,
         validityDays: 60,
         price: 8000,
         currency: 'BYN',
       })

       const event = await eventService.create({ userId: owner.id, db }, org.id, {
         type: 'training',
         title: 'Тренировка',
         startsAt: new Date(Date.now() + 86400000),
         endsAt: new Date(Date.now() + 90000000),
         venueId: venue.id,
         capacity: 2,
         price: 1000,
         cancellationDeadlineHours: 2,
       })

       // === ИГРОКИ: покупают абонементы ===
       const sub1 = await subscriptionService.createFromPlan(
         { userId: p1.id, db },
         org.id,
         plan.id,
         { autoActivate: true },
       )
       const sub2 = await subscriptionService.createFromPlan(
         { userId: p2.id, db },
         org.id,
         plan.id,
         { autoActivate: true },
       )
       expect(sub1.status).toBe('active')

       // === ИГРОКИ: записываются ===
       const b1 = await bookingService.book({ userId: p1.id, db }, org.id, event.id, {
         method: 'subscription',
       })
       expect(b1.status).toBe('confirmed')
       const b2 = await bookingService.book({ userId: p2.id, db }, org.id, event.id, {
         method: 'subscription',
       })
       expect(b2.status).toBe('confirmed')
       // capacity=2 заполнен, p3 → waitlist
       const b3 = await bookingService.book({ userId: p3.id, db }, org.id, event.id, {
         method: 'cash',
       })
       expect(b3.status).toBe('waitlisted')

       // Проверка: sub1, sub2 списали по 1 сессии; p3 (cash, waitlist) — ничего
       const s1after = await subscriptionService.getById({ userId: p1.id, db }, sub1.id)
       expect(s1after.usedSessions).toBe(1)

       // === computed counts ===
       const events = await eventService.list({ userId: owner.id, db }, org.id, {
         filter: 'upcoming',
       })
       const ev = events.find((e) => e.id === event.id)!
       expect(ev.confirmedCount).toBe(2)
       expect(ev.waitlistCount).toBe(1)
       expect(ev.availableSpots).toBe(0)

       // === ОТМЕНА p1 → restore sub1 + promote p3 ===
       const cancelResult = await bookingService.cancel({ userId: p1.id, db }, b1.id)
       expect(cancelResult.booking.status).toBe('cancelled')
       expect(cancelResult.promoted).toBeTruthy()
       expect(cancelResult.promoted!.userId).toBe(p3.id)
       // p3 был cash → promoted в pending_payment (слот закреплён)
       expect(cancelResult.promoted!.status).toBe('pending_payment')

       // sub1 восстановлен
       const s1restored = await subscriptionService.getById({ userId: p1.id, db }, sub1.id)
       expect(s1restored.usedSessions).toBe(0)

       // === ИНВАРИАНТ: confirmed <= capacity ===
       const eventsAfter = await eventService.list({ userId: owner.id, db }, org.id, {
         filter: 'upcoming',
       })
       const evAfter = eventsAfter.find((e) => e.id === event.id)!
       expect(evAfter.confirmedCount).toBeLessThanOrEqual(event.capacity)

       // === ОРГАНИЗАТОР: отмечает посещаемость p2 (confirmed) ===
       const attended = await bookingService.markAttendance(
         { userId: owner.id, db },
         b2.id,
         'attended',
       )
       expect(attended.status).toBe('attended')
     })

     test('free event flow: no subscription needed', async () => {
       const db = testDb.db
       const owner = await createTestUser(db, { email: 'o@t.com' })
       const org = await organizationService.create({ userId: owner.id, db }, { name: 'Free Club' })
       const player = await createTestUser(db, { email: 'pl@t.com' })
       await memberService.addMember(
         { userId: owner.id, db },
         { organizationId: org.id, userId: player.id, role: 'player', status: 'active' },
       )

       const event = await eventService.create({ userId: owner.id, db }, org.id, {
         type: 'open_game',
         title: 'Бесплатная игра',
         startsAt: new Date(Date.now() + 86400000),
         endsAt: new Date(Date.now() + 90000000),
         capacity: 10,
         price: 0,
       })

       const booking = await bookingService.book({ userId: player.id, db }, org.id, event.id, {
         method: 'free',
       })
       expect(booking.status).toBe('confirmed')
       expect(booking.method).toBe('free')
     })
   })
   ```

2. **Документировать как acceptance:**
   ```ts
   // PHASE 5 ACCEPTANCE: этот тест моделирует реальный сценарий из UI:
   // организатор (5.10) создаёт событие/план → игроки (5.11) покупают абонементы →
   // (5.9) записываются → (5.10.3) отметка посещаемости → отмена с промоушеном (5.6).
   // Зелёный тест = Phase 5 backend готов к UI-интеграции.
   ```

## Критерии приёмки

- ✅ Полный сценарий проходит: setup → venue/plan/event → subscribe → book (confirmed×2 + waitlist) → cancel+restore+promote → attendance
- ✅ Subscription consume/restore корректны (used 0→1→0)
- ✅ Computed counts корректны (confirmed=2, waitlist=1, available=0)
- ✅ Promotion: p3 (cash) → pending_payment при промоушене
- ✅ Инвариант confirmed ≤ capacity держится
- ✅ Free event flow без абонемента
- ✅ Тест изолирован, стабилен

## Подсказки

- **Это «золотой путь»** — самый реалистичный сценарий. Если зелёный, основная функциональность Phase 5 работает.
- **Координация с 5.8.2:** 5.8.2 фокус на cancellation/promotion вариантах. Здесь — единый сквозной сценарий через все модули в UI-порядке. Допустимо частичное пересечение.
- **Проверяй computed после операций** — confirmedCount/availableSpots это то, что увидит UI.

## Не делать

- ❌ Не делать через HTTP (Playwright) — Phase 9
- ❌ Не дублировать узкие edge cases из 5.8 — здесь сквозной happy path + ключевые проверки
