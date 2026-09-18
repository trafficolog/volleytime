---
id: '15.8.2'
phase: '15'
epic: '15.8'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: ''
roles:
  - QA
  - BACK
depends_on:
  - '15.5.3'
  - '15.6.1'
  - '15.7.2'
estimated_hours: '1-2'
tags:
  - tests
  - waitlist
  - ttl
  - notifier
---

# Task 15.8.2: Waitlist confirm-flow + TTL + notify retry tests

## Цель

Тесты: waitlist confirm-flow (offer→confirm→состав, offer→TTL→следующий, FIFO), TTL pending (online/cash), очередь уведомлений с retry.

## Контекст

Самая сложная логика фазы (confirm-flow меняет Phase 5). Тщательные тесты: подтверждение, истечение, переход по очереди, без зацикливания, cash-защита TTL.

## Что должно быть сделано

1. **Waitlist confirm-flow tests:**

   ```ts
   describe('waitlist confirm-flow', () => {
     test('freed slot → offer to first (not auto-promote)', async () => {})
     test('offered reserves slot (capacity)', async () => {})
     test('confirm offer → confirmed (subscription)', async () => {})
     test('confirm offer cash → pending_payment', async () => {})
     test('offer TTL expires → next in queue offered', async () => {})
     test('expired offer → back to waitlist, not re-offered immediately (no loop)', async () => {})
     test('FIFO order maintained', async () => {})
     test('confirm before TTL → TTL handler no-op', async () => {})
     test('empty waitlist after expiry → slot free', async () => {})
     test('double confirm → idempotent', async () => {})
   })
   ```

2. **TTL pending tests:**

   ```ts
   describe('pending TTL (online-only)', () => {
     test('online pending → TTL registered', async () => {})
     test('cash pending → NO TTL', async () => {})
     test('transfer pending → NO TTL', async () => {})
     test('online TTL expires → cancelled + offer next', async () => {})
     test('handler ignores cash even if invoked', async () => {})
     test('paid before TTL → no-op', async () => {})
   })
   ```

3. **Notify queue tests:**

   ```ts
   describe('notification queue', () => {
     test('sendReliable enqueues notify.deliver', async () => {})
     test('critical notifications use sendReliable', async () => {})
     test('non-critical use direct send', async () => {})
     test('delivery retry on failure', async () => {})
     test('exhausted retries logged', async () => {})
   })
   ```

4. **Анти-зацикливание** — критичный тест: истёкший offer не предлагается ему же сразу (вечный цикл).

5. **Cash-защита TTL** — критичный тест: cash-бронь не получает TTL и не отменяется.

## Критерии приёмки

- ✅ Confirm-flow: offer/confirm/expire/next/FIFO/no-loop/idempotent
- ✅ Capacity учитывает offered
- ✅ TTL: online да, cash/transfer нет, handler-защита
- ✅ Notify: sendReliable очередь, критичные vs прямые, retry
- ✅ Анти-зацикливание проверено
- ✅ Cash-защита TTL проверена
- ✅ ≥ 12 тестов

## Подсказки

- **Анти-зацикливание и cash-защита — самые важные.** Это где легко ошибиться (вечный цикл предложений; отмена наличных). Явные тесты обязательны.
- **offered capacity** — проверить что зарезервированное место не показывается свободным (иначе двойная запись).
- **Прямой вызов handler** — TTL/offer handlers вызываем с состоянием БД, без ожидания pg-boss.
- **idempotent confirm** — двойное нажатие кнопки (частый кейс в Telegram) не ломает.

## Не делать

- ❌ Не пропускать анти-зацикливание и cash-защиту
- ❌ Не ждать реального времени
- ❌ Не дублировать Phase 5 booking тесты
