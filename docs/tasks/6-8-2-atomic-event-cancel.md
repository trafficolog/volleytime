---
id: '6.8.2'
phase: '6'
epic: '6.8'
status: done
sync_state: synced
last_reviewed: 2026-09-16
status_note: ''
review_ref: 'Phase 6 · P0 #2'
priority: P0
roles:
  - BACK
depends_on:
  - '6.8.1'
estimated_hours: '1-2'
tags:
  - events
  - refund
  - concurrency
  - review-fix
---

# Task 6.8.2: Атомарная отмена события: блокировка строки, один возврат на платёж

## Цель

Параллельная/повторная отмена события не создаёт повторных возвратов.

## Контекст

Две параллельные отмены → 2 расхода-возврата по одному платежу, повторное восстановление сессий.

## Что должно быть сделано

1. `eventService.cancel(ctx, orgId, eventId)`: `SELECT … FOR UPDATE` события; `status = cancelled` → no-op; иначе обработка броней.
2. Возврат: условный `UPDATE payments SET status='refunded' WHERE status='succeeded'` → расход только если строка обновилась; уникальный индекс refund (6.8.1).
3. `pg_advisory_xact_lock(eventId)` — сериализация с записью/отменой броней.
4. Тест: 2–5 параллельных отмен → 1 возврат на платёж, `used_sessions` восстановлен один раз.

## Критерии приёмки

- ✅ Сумма расходов-возвратов = сумме оплаченных броней, независимо от числа отмен

## Подсказки

-

## Не делать

- ❌ Не выполнять возврат по прочитанному статусу
