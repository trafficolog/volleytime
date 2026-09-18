---
id: '7.3.1'
phase: '7'
epic: '7.3'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
depends_on:
  - '7.1.2'
  - '5.2.2'
estimated_hours: '1-2'
tags:
  - credits
  - events
  - spend
---

# Task 7.3.1: Credit spend в eventService.create (блок при 0)

## Цель

Создание Event списывает 1 credit. Баланс 0 → блок (InsufficientCreditsError → UI к покупке). Атомарно (Event + spend).

## Контекст

Решения 1, 3: spend при создании, жёсткий блок при 0. eventService.create (5.2.2) расширяется: проверка/списание credit атомарно с созданием Event.

## Что должно быть сделано

1. **Расширить eventService.create (5.2.2):**

   ```ts
   import { creditService } from '../credits'

   async create(ctx, orgId, input) {
     return await db.transaction(async (tx) => {
       // 1. spend credit (бросит InsufficientCreditsError если баланс 0)
       //    делаем ДО создания Event — если нет credits, не создаём
       // создаём Event сначала (нужен eventId для transaction), затем spend:
       const event = await eventRepository.create(tx, { organizationId: orgId, ...input })

       await creditService.addTransaction({ ...ctx, db: tx }, {
         organizationId: orgId,
         type: 'spend',
         amount: -1,
         eventId: event.id,
         note: `Создание события «${event.title}»`,
       })
       // addTransaction бросит InsufficientCreditsError если баланс < 1 → откат транзакции (Event не создан)

       return event
     })
   }
   ```

   Порядок: создать Event (для eventId) → spend. Если spend бросает (нет credits) → транзакция откатывается, Event не сохранён. Чисто.

2. **Error handling:** InsufficientCreditsError (credits.insufficient) → API возвращает 402/403 с понятным сообщением. handle-errors:

   ```ts
   'credits.insufficient': 402,  // Payment Required — семантично
   ```

3. **Feature flag (опц):** монетизация может включаться флагом (CREDITS_ENABLED). Если выключено (ранняя бета) — не списывать. Для Phase 7 — включено. Отметить возможность отключения для отладки.

4. **Тесты:**
   ```ts
   test('create event spends 1 credit', async () => {})
   test('create event with 0 balance → InsufficientCreditsError, event NOT created', async () => {})
   test('spend transaction linked to event', async () => {})
   test('balance decreases by 1 after create', async () => {})
   test('atomic: spend failure rolls back event', async () => {})
   ```

## Критерии приёмки

- ✅ Создание Event → spend −1 credit
- ✅ Баланс 0 → InsufficientCreditsError, Event НЕ создан (откат)
- ✅ spend transaction linked to eventId
- ✅ Атомарно (Event + spend одна транзакция)
- ✅ API: insufficient → 402 + понятное сообщение
- ✅ Опц feature flag (CREDITS_ENABLED)
- ✅ Тесты (включая atomic rollback)

## Подсказки

- **Порядок Event→spend в транзакции:** создаём Event (нужен id для transaction.eventId), затем spend. Если spend бросает — вся транзакция откатывается, Event исчезает. Атомарность даёт чистоту.
- **402 Payment Required** — семантичный код для «нужны credits». UI ловит → ведёт к покупке (7.6).
- **InsufficientCreditsError уже в 7.1.2** — addTransaction бросает при балансе < 1. Здесь просто пробрасываем в API.
- **Feature flag** — на случай если в части беты монетизацию не включать. Гибкость отладки.

## Не делать

- ❌ Не создавать Event при недостатке credits (откат)
- ❌ Не списывать за draft (если есть) — за создание published
- ❌ Не разрешать минус
- ❌ Не делать UI — эпик 7.6
