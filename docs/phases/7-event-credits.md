---
id: '7'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: 'Платформенная монетизация. Event credits. РАЗБЛОКИРОВАНА (Трек A готов). Расширяет super-admin (Phase 10). Тарифная сетка настраиваемая.'
estimated_hours: '20-30'
depends_on: ['6', '10']
---

# Phase 7: Event Credits — платформенная монетизация

**Цель.** Платформа продаёт организатору право создавать события (credits). Новая организация получает 5 demo credits. Создание события списывает 1 credit (refund при отмене до открытия записи). Покупка credits — по настраиваемой тарифной сетке (цена за кредит снижается с объёмом), произвольное количество, оплата подтверждается root-админом.

## Контекст

Первый источник дохода. Трек A готов (юридическая основа приёма платежей). Гейт Phase 10 (Private Beta) ведёт сюда: успешная бета → технически проверяем готовность платить.

**Монетизация event credits (не подписки):** до public launch монетизируемся через credits (BILLING стратегия). Подписки/планы/feature entitlements — позже (Phase 11+, когда появятся платные фичи). Phase 7 = только credits.

## Предусловия

- ✅ Phase 6: Payment + Ledger (для понимания денежных потоков, хотя платёж за credits — доход платформы, не org-кассы)
- ✅ Phase 10: super-admin (10.3) — расширяем функцией grant credits / управление тарифами
- ✅ Трек A готов: юридическая основа приёма платежей платформой
- ✅ Гейт Phase 10 пройден: ≥1 организатор готов платить (проверяем технически)

## Definition of Done

1. ✅ EventCreditAccount (баланс) + EventCreditTransaction (журнал, append-only)
2. ✅ Новая организация → 5 demo credits (grant при создании)
3. ✅ Создание Event → −1 credit; баланс 0 → блок с понятным сообщением «купите credits»
4. ✅ Отмена Event ДО открытия записи → +1 credit (refund); после открытия — credit потрачен
5. ✅ Настраиваемая тарифная сетка: пороги количества → цена за кредит (root-admin редактирует)
6. ✅ Покупка произвольного количества (для теста тоже), цена авто-расчёт по сетке
7. ✅ Заявка на покупку → root-admin подтверждает оплату → grant credits + transaction
8. ✅ Organizer видит баланс + историю транзакций
9. ✅ Root-admin (расширенный super-admin): grant credits, подтверждение заявок, управление тарифами, audit
10. ✅ Покупка фиксируется в EventCreditTransaction (количество + сумма), без платформенного ledger пока
11. ✅ ≥ 12 тестов (spend, refund, demo grant, тарифный расчёт, заявка-подтверждение)

## Архитектура Phase 7

### Новые модели

```
packages/db/src/schema/
├── event-credit-accounts.ts       # баланс организации
├── event-credit-transactions.ts   # журнал (grant/spend/refund/purchase) append-only
├── credit-pricing-tiers.ts        # ★ настраиваемая тарифная сетка (порог → цена/кредит)
└── credit-purchase-requests.ts    # заявки на покупку (pending → confirmed/rejected)
```

### Новый модуль

```
apps/web/modules/credits/
├── account     # баланс, демо-грант
├── transaction # журнал, spend/refund/grant
├── pricing     # тарифная сетка, расчёт суммы по количеству
└── purchase    # заявки на покупку
```

### Интеграция

```
organizationService.create  → grant 5 demo credits
eventService.create         → spend 1 credit (блок если 0)
eventService.cancel (до откр. записи) → refund 1 credit
super-admin (10.3)          → grant credits, confirm purchase requests, manage tiers
```

## Эпики

| ID  | Эпик                                         | Задач | Часов |
| --- | -------------------------------------------- | ----: | ----: |
| 7.1 | Credit account + transaction модели          |     2 |   3-4 |
| 7.2 | Demo quota grant при создании org            |     1 |     1 |
| 7.3 | Credit spend при создании Event + refund     |     2 |   3-4 |
| 7.4 | Тарифная сетка (настраиваемая) + расчёт цены |     2 |   3-4 |
| 7.5 | Заявки на покупку + подтверждение            |     2 |   3-4 |
| 7.6 | UI organizer: баланс, история, покупка       |     2 |   3-4 |
| 7.7 | Root-admin: grant, confirm, тарифы, audit    |     2 |   3-4 |
| 7.8 | Tests                                        |     2 |   3-4 |

**Итого:** 8 эпиков, ~15 задач, 20-30 часов.

## Технические заметки

### Утверждённые решения

1. **Spend при создании Event** (−1 credit), refund при отмене до открытия записи
2. **5 demo credits** новой организации
3. **Жёсткий блок при 0** (нет долга/grace), UI «купите credits»
4. **Тарифная сетка настраиваемая (вариант C):** root-admin задаёт пороги количества → цена за кредит; покупатель вводит произвольное количество (тест тоже), цена авто-расчёт. «Пакеты» = подсказки-кнопки (быстрый выбор), не жёсткие
5. **Заявка → подтверждение root-админом** (Phase 7 ручное; self-service online — Phase 12 bePaid)
6. **Покупка в EventCreditTransaction** (количество + сумма), без платформенного ledger (платформенный финучёт — отдельно, Трек A)
7. **Root-admin = расширенный super-admin** (10.3): grant, confirm, тарифы, audit
8. **Только event credits** в Phase 7 (Feature/Plan/OrganizationFeature entitlements — Phase 11+)
9. **UI:** баланс + история + покупка (organizer) + root grant
10. **Вся фаза за раз**

### Тарифная сетка (вариант C) — как работает

```
credit_pricing_tiers (редактируется root-админом):
  min_quantity=1   → price_per_credit=500 (5.00 BYN, в minor)
  min_quantity=10  → price_per_credit=400 (4.00)
  min_quantity=30  → price_per_credit=350 (3.50)
  min_quantity=100 → price_per_credit=300 (3.00)

Расчёт (flat-tier): для количества Q берётся tier с наибольшим
  min_quantity ≤ Q, ВСЕ Q кредитов по этой цене.
  Пример: Q=35 → tier min=30 → 35 × 3.50 = 122.50 BYN
          Q=100 → tier min=100 → 100 × 3.00 = 300 BYN

Покупатель: вводит Q (или выбирает подсказку 10/30/100), видит авто-сумму.
Пороги/цены полностью настраиваются (можно менять для теста).
```

### Что НЕ делаем в Phase 7

- ❌ Feature/Plan/OrganizationFeature entitlements — Phase 11+ (когда платные фичи/подписки)
- ❌ Online-оплата credits (bePaid) — Phase 12 (Phase 7 — ручное подтверждение)
- ❌ Платформенный ledger/финучёт — отдельно (Трек A, налоги)
- ❌ Подписки/месячные планы — после public launch
- ❌ Долг/grace при 0 балансе (жёсткий блок)
- ❌ Прогрессивное (marginal) ценообразование — flat-tier (вся партия по одной цене)
- ❌ Авто-списание за доп. функции — только за создание Event

## Ссылки

- [BILLING_AND_ENTITLEMENTS.md](../strategy/BILLING_AND_ENTITLEMENTS.md) — стратегия монетизации
- [DOMAIN.md](../DOMAIN.md#feature-plan-addon) — EventCreditAccount/Transaction
- [10-3-super-admin-overview.md](../epics/10-3-super-admin-overview.md) — super-admin (расширяем)
- [6-2-ledger-service.md](../epics/6-2-ledger-service.md) — org-касса (НЕ платформенный доход)
