---
id: '6.4'
phase: '6'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Отмена события → restore сессий + refund payments + cancel pending.'
estimated_hours: '3-4'
depends_on: ['6.1', '6.2', '5.6']
---

# Epic 6.4: Mass refund при отмене события

**Цель.** Расширить eventService.cancel (заглушка из 5.2.2): при отмене события организатором — массово обработать все активные брони: restore сессий абонементов, refund succeeded payments, cancel pending payments.

## Контекст

В 5.2.2 cancel просто менял статус с комментарием «mass refund — Phase 6». Теперь реализуем.

Решение 8: автоматический mass refund. Для каждой не-cancelled брони события:

- subscription booking → restore session
- succeeded payment → refund (ledger expense)
- pending payment → cancel
- booking → cancelled

## Definition of Done

- eventService.cancel (или новый eventService.cancelWithRefund) обрабатывает все брони транзакционно
- subscription bookings → restoreSession (5.5.4)
- succeeded payments → paymentService.refund (ledger expense refund)
- pending payments → paymentService.cancel
- Все bookings → cancelled
- Event → cancelled
- Idempotent (повторная отмена безопасна)
- Audit (event.cancelled, mass refund summary)
- Тесты: смешанные методы оплаты в одном событии

## Задачи

| ID    | Задача                                             | Часов |
| ----- | -------------------------------------------------- | ----: |
| 6.4.1 | eventService.cancelWithRefund (mass refund логика) |     2 |
| 6.4.2 | Integration тесты + API подключение                |   1-2 |

## Не делать

- ❌ Не делать частичную отмену (отдельных броней) — это обычный cancel
- ❌ Не уведомлять игроков — Phase 8
- ❌ Не делать refund для self-cancel (только при отмене всего события)
