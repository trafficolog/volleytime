---
id: '15.5'
phase: '15'
status: todo
sync_state: drifted
last_reviewed: 2026-05-30
status_note: 'Waitlist promotion → confirm-flow (предложение+TTL+следующий). Заменяет авто Phase 5.'
estimated_hours: '4-5'
depends_on: ['15.1', '5.6', '8.5']
---

# Epic 15.5: Waitlist promotion confirm-flow (заменяет авто)

**Цель.** Заменить авто-promotion (Phase 5) на confirm-flow: место освободилось → первому из waitlist предложение с inline-кнопкой + TTL 30 мин → подтвердил (в состав) / истёк (следующий).

## Контекст

Решение 6: confirm-flow решает проблему no-show при авто-promotion (продвигали того, кто уже не придёт). Меняет bookingService.promoteFromWaitlist (5.6.2) и уведомление waitlist_promoted → waitlist_offer (8.5.3).

Это самый сложный эпик: меняет поведение ядра, добавляет состояние «offered», inline-кнопку в боте, TTL-задачу, переход к следующему.

## Definition of Done

- Освобождение места → НЕ авто-promote, а offer первому в waitlist
- Booking получает состояние «offered» (или offer_expires_at) — место зарезервировано на 30 мин
- Уведомление с inline-кнопкой «Подтверждаю участие» (bot callback)
- Подтвердил → confirmed (или pending_payment если cash) + следующие не получают это место
- TTL 30 мин истёк / отказался → offer снимается, предложение следующему
- Очередь waitlist соблюдается (FIFO)
- Если waitlist пуст → место остаётся свободным
- Idempotent (двойной callback не ломает)

## Задачи

| ID     | Задача                                                         | Часов |
| ------ | -------------------------------------------------------------- | ----: |
| 15.5.1 | Booking offered-состояние + offer логика (вместо авто-promote) |     2 |
| 15.5.2 | Inline-confirm callback (bot) + переход в состав               |   1-2 |
| 15.5.3 | TTL offer (30мин) → следующий + waitlist_offer уведомление     |   1-2 |

## Не делать

- ❌ Не оставлять авто-promotion (заменяем на confirm)
- ❌ Не предлагать место нескольким сразу (по очереди, FIFO)
- ❌ Не терять место если callback пришёл с задержкой (грейс в пределах TTL)
- ❌ Не ломать обычную отмену (cancel остаётся)
