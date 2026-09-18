---
id: '15.8.1'
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
  - '15.3.2'
  - '15.4.2'
estimated_hours: '1-2'
tags:
  - tests
  - scheduler
  - freeze-time
---

# Task 15.8.1: Job lifecycle + reminders + auto-close/finish tests

## Цель

Тесты с freeze time: регистрация/отмена задач, reminders (idempotent, актуальность), auto-close, auto-finish.

## Контекст

Time-based логику тестируем без реального ожидания — fake timers / инъекция now / прямой вызов handler с нужным состоянием. Проверяем корректность срабатывания и идемпотентность.

## Что должно быть сделано

1. **Стратегия тестирования времени:**
   - Прямой вызов handler-функций (sendReminders, autoCloseEvent, autoFinish) с подготовленным состоянием БД — не ждём pg-boss, тестируем логику handler
   - Регистрацию задач проверяем по event_jobs (правильное runAt) без реального срабатывания
   - vitest fake timers где нужно now-логика

2. **Lifecycle tests `apps/web/modules/events/__tests__/jobs.integration.test.ts`:**

   ```ts
   describe('event job lifecycle', () => {
     test('create registers 24h/2h/finish with correct runAt', async () => {})
     test('event <24h → no 24h reminder registered', async () => {})
     test('cancel removes all event jobs', async () => {})
     test('update time reschedules jobs', async () => {})
   })
   ```

3. **Reminder tests:**

   ```ts
   describe('reminders', () => {
     test('reminder_24h sends to confirmed only', async () => {})
     test('does not send to waitlisted/pending/cancelled', async () => {})
     test('idempotent: second run does not duplicate', async () => {})
     test('cancelled event → no reminders sent', async () => {})
     test('player cancelled between 24h and 2h → no 2h reminder', async () => {})
   })
   ```

4. **Auto-close/finish tests:**
   ```ts
   describe('auto-close & finish', () => {
     test('reminder_2h closes published event', async () => {})
     test('closed event rejects new booking', async () => {})
     test('closed allows cancellation', async () => {})
     test('auto_finish: closed → finished', async () => {})
     test('auto_finish: cancelled stays cancelled', async () => {})
   })
   ```

## Критерии приёмки

- ✅ Lifecycle: регистрация (правильное runAt), отмена, перерегистрация
- ✅ Reminders: confirmed only, idempotent, cancelled-skip
- ✅ Auto-close: published→closed, book reject, cancel allowed
- ✅ Auto-finish: closed→finished, cancelled stays
- ✅ Freeze time / прямой вызов handler
- ✅ ≥ 8 тестов

## Подсказки

- **Тестируем логику handler, не pg-boss** — вызываем sendReminders/autoClose напрямую с состоянием БД. pg-boss (срабатывание по времени) — его не тестируем, доверяем библиотеке.
- **runAt проверяем по event_jobs** — задача зарегистрирована на правильное время, без ожидания.
- **Idempotency-тест** — вызвать handler дважды, проверить отсутствие дублей (флаги отправки).

## Не делать

- ❌ Не ждать реального времени
- ❌ Не тестировать pg-boss внутренности
- ❌ Не делать E2E
