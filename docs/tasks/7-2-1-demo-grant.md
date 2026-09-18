---
id: '7.2.1'
phase: '7'
epic: '7.2'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: ''
roles:
  - BACK
depends_on:
  - '7.1.2'
  - '4.1'
estimated_hours: '1'
tags:
  - credits
  - onboarding
---

# Task 7.2.1: Demo grant в organizationService.create

## Цель

При создании организации автоматически начислять 5 demo credits (transaction demo_grant), атомарно с созданием org.

## Контекст

Решение 2: 5 demo credits. organizationService.create (Phase 4.1) расширяется: после создания org → creditService.addTransaction(demo_grant, +5). Атомарно.

## Что должно быть сделано

1. **Конфиг demo-квоты:**

   ```ts
   const DEMO_CREDITS = Number(process.env.DEMO_CREDITS ?? 5)
   ```

2. **Расширить organizationService.create (4.1):**

   ```ts
   import { creditService } from '../credits'

   async create(ctx, input) {
     return await db.transaction(async (tx) => {
       const org = await orgRepository.create(tx, { ... })  // существующее
       // ... owner membership и т.д. (4.1) ...

       // demo credits grant (Phase 7)
       await creditService.addTransaction({ ...ctx, db: tx }, {
         organizationId: org.id,
         type: 'demo_grant',
         amount: DEMO_CREDITS,
         note: `Демо-квота новой организации (${DEMO_CREDITS} credits)`,
       })

       return org
     })
   }
   ```

3. **Атомарность:** org + membership + demo grant в одной транзакции. Сбой → ничего не создано.

4. **Тесты:**

   ```ts
   test('new org gets DEMO_CREDITS demo_grant', async () => {})
   test('demo grant atomic with org creation', async () => {})
   test('demo credits balance == DEMO_CREDITS after create', async () => {})
   test('DEMO_CREDITS configurable via env', async () => {})
   ```

5. **Связь с beta allowlist (10.1):** create уже проверяет allowlist (Phase 10). demo grant — после успешного прохождения allowlist + создания. Порядок: allowlist check → create org → demo grant.

## Критерии приёмки

- ✅ Новая org → demo_grant transaction (+5, конфиг)
- ✅ Атомарно с созданием org (одна транзакция)
- ✅ Баланс == DEMO_CREDITS после создания
- ✅ DEMO_CREDITS конфигурируем (env, дефолт 5)
- ✅ Не начисляется повторно (только create)
- ✅ Тесты

## Подсказки

- **Атомарность критична** — org без credits account или credits без org = битое состояние. Одна транзакция.
- **Порядок с allowlist (10.1):** allowlist-проверка ДО создания (не прошёл → не создаём, не грантим). demo grant — последний шаг успешного create.
- **DEMO_CREDITS env** — легко менять для экспериментов (бета может тестировать разные квоты).
- **note осмысленный** — в истории транзакций видно «демо-квота».

## Не делать

- ❌ Не начислять demo повторно (только create)
- ❌ Не грантить до прохождения allowlist
- ❌ Не хардкодить 5
- ❌ Не разрывать атомарность
