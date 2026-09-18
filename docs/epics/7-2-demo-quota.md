---
id: '7.2'
phase: '7'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: '5 demo credits новой организации при создании.'
estimated_hours: '1'
depends_on: ['7.1', '4.1']
---

# Epic 7.2: Demo quota grant при создании org

**Цель.** Новая организация автоматически получает 5 demo credits (transaction type=demo_grant) при создании.

## Контекст

Решение 2: 5 demo credits. Даёт попробовать (≈месяц еженедельных тренировок) без оплаты. Grant в organizationService.create, атомарно с созданием org.

## Definition of Done

- organizationService.create создаёт EventCreditAccount + demo_grant transaction (5 credits)
- Атомарно с созданием организации (одна транзакция)
- Размер demo-квоты конфигурируем (env/const DEMO_CREDITS=5)
- Повторно не начисляется (только при создании)

## Задачи

| ID    | Задача                                  | Часов |
| ----- | --------------------------------------- | ----: |
| 7.2.1 | Demo grant в organizationService.create |     1 |

## Не делать

- ❌ Не начислять demo повторно (только создание)
- ❌ Не хардкодить 5 (конфиг)
