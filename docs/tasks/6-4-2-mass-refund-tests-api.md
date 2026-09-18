---
id: '6.4.2'
phase: '6'
epic: '6.4'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 6.8.'
roles:
  - BACK
  - QA
depends_on:
  - '6.4.1'
  - '5.2.4'
estimated_hours: '1-2'
tags:
  - tests
  - api
  - refund
---

# Task 6.4.2: Integration тесты + API подключение

## Цель

Integration-тесты mass refund (смешанные методы оплаты). Подключение к API (event cancel endpoint уже есть в 5.2.4 — проверить что вызывает обновлённый cancel).

## Контекст

mass refund — критичная финансовая операция. Тщательные тесты обязательны. API endpoint cancel из 5.2.4 теперь вызывает расширенный eventService.cancel (6.4.1).

## Что должно быть сделано

1. **Проверить API** `events/[eventId]/cancel.post.ts` (5.2.4) — вызывает eventService.cancel, который теперь делает mass refund. Изменений в endpoint не нужно (логика в сервисе), но проверить permission (canManageContent) и обработку.

2. **Integration тесты** (`apps/web/modules/events/__tests__/mass-refund.integration.test.ts`):

   ```ts
   describe('mass refund on event cancellation', () => {
     test('mixed methods: subscription + cash(succeeded) + cash(pending) + free', async () => {
       // Setup: event capacity=4, price>0
       // p1: subscription booking (consumed session)
       // p2: cash booking → payment succeeded (confirmed)
       // p3: cash booking → payment pending (pending_payment)
       // p4: free... (нет, price>0, все платят) — используем 3 игрока
       //
       // Cancel event →
       //   p1: session restored (used 1→0), booking cancelled
       //   p2: payment refunded (ledger expense), booking cancelled
       //   p3: payment cancelled, booking cancelled
       //   event cancelled
       // Verify ledger: было income от p2, теперь expense refund p2 → net 0 по p2
     })

     test('all subscription bookings → all sessions restored', async () => {})

     test('idempotent: double cancel safe', async () => {})

     test('ledger balance after refund reflects expenses', async () => {
       // income 1500 (p2 confirm) → cancel → expense 1500 (refund) → balance 0
     })

     test('cancelled event cannot be booked', async () => {
       // после cancel попытка book → EventNotBookableError
     })

     test('waitlisted bookings also cancelled on event cancel', async () => {})
   })
   ```

3. **Инвариант-проверки:**
   ```ts
   // после mass refund:
   // - все booking события: status cancelled
   // - subscription sessions: restored (used вернулся)
   // - succeeded payments: refunded
   // - pending payments: cancelled
   // - ledger: refund expenses == сумма succeeded payments
   ```

## Критерии приёмки

- ✅ Mixed methods тест: subscription restore + cash refund + pending cancel — всё корректно
- ✅ All subscription → все сессии восстановлены
- ✅ Idempotent (повторный cancel)
- ✅ Ledger balance: income от confirm компенсируется refund expense
- ✅ Cancelled event не бронируется
- ✅ Waitlisted брони тоже отменяются
- ✅ Инварианты держатся
- ✅ API cancel endpoint работает через обновлённый сервис

## Подсказки

- **Net-эффект refund на ledger:** confirm создал income +1500, refund создаёт expense −1500 (как expense, уменьшает баланс). Итоговый баланс по этому платежу 0. Деньги физически вернулись игроку.
- **Проверяй до и после:** balance до cancel, после — разница = сумма refund.
- **Все брони включая waitlist** отменяются (событие целиком отменено).
- **Координация с 6.7:** 6.7.3 — финальные mass refund тесты. Здесь — базовая интеграция в рамках эпика. Допустимо пересечение, 6.7.3 расширяет.

## Не делать

- ❌ Не дублировать всё в 6.7.3 (там агрегирующие)
- ❌ Не делать HTTP E2E — Phase 9
- ❌ Не уведомлять — Phase 8
