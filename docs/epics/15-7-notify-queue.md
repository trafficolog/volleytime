---
id: '15.7'
phase: '15'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: 'Критичные уведомления через очередь с retry (notify.deliver). Закрывает долг Phase 8.'
estimated_hours: '3-4'
depends_on: ['15.1', '8.4']
---

# Epic 15.7: Очередь уведомлений с retry (notify.deliver)

**Цель.** Перевести критичные уведомления (promotion-offer, payment confirmed/rejected) на доставку через pg-boss с retry (3 попытки). Закрывает слабое место Phase 8 (fire-and-forget теряет при сбое).

## Контекст

Решение 7: Phase 8 notifier — fire-and-forget (упал Telegram → потеряно). Раз есть job runner — критичные уведомления через notify.deliver job с retry. Менее критичные (booking confirmed и т.д.) можно оставить прямыми.

## Definition of Done

- notify.deliver job: payload (userId, type, data) → доставка через notifier transport
- Retry: 3 попытки с backoff при сбое (Telegram недоступен)
- Критичные уведомления (waitlist_offer, payment_confirmed/rejected, event_cancelled) → через очередь
- notifierService.sendReliable (через очередь) vs send (прямой, для некритичных)
- Dead-letter / лог после исчерпания попыток (не молча терять)
- Idempotent (повторная доставка при retry не дублирует с точки зрения пользователя — приемлемо, или dedup-ключ)

## Задачи

| ID     | Задача                                    | Часов |
| ------ | ----------------------------------------- | ----: |
| 15.7.1 | notify.deliver job + retry + sendReliable |     2 |
| 15.7.2 | Перевод критичных уведомлений на очередь  |   1-2 |

## Не делать

- ❌ Не переводить ВСЕ уведомления на очередь (только критичные)
- ❌ Не терять молча после исчерпания retry (лог/dead-letter)
- ❌ Не блокировать бизнес-операцию доставкой (по-прежнему после коммита)
