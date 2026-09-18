# 💰 Billing & Entitlements

> **Last updated:** 2026-05-25
> Биллинг платформы Volley Time: planы, тарифы, feature entitlements, event credits.

---

## Принципы

1. **Feature entitlements, не хардкод по plan-коду.** Доступ к функции определяется записью в `OrganizationFeature`, а не названием тарифа. Это даёт гибкость: trial, addon, beta-доступ, admin grant.

2. **Event credits как основа MVP.** До public launch монетизируемся через event credits (не через подписки).

3. **Подписки появляются позже.** После Phase 10 (Private Beta) добавляем месячные tier-планы.

4. **Add-ons всегда отдельно.** Online Payments, CRM Pro — это add-ons, которые могут быть включены к любому plan.

5. **Трансакционно прозрачно.** Каждое движение credits — отдельная запись в `EventCreditTransaction`. Можно отследить любой spend / refund.

---

## Доменные сущности

См. полные определения в [../DOMAIN.md](../DOMAIN.md#feature-plan-addon).

- `Feature` — каталог фич: `online_payments`, `crm_pro`, `tournaments`, `contributions`, `reports`, etc.
- `Plan` — каталог тарифов: `start`, `regular`, `club`, `pro`, `tournament`.
- `PlanFeature` — какие фичи включены в plan, с лимитами.
- `AddOn` — отдельно покупаемая фича (`online_payments_addon`, `crm_pro_addon`).
- `OrganizationSubscription` — подписка организации на plan.
- `OrganizationFeature` — final-source-of-truth: какие фичи доступны конкретной организации.
- `EventCreditAccount` — баланс credits организации.
- `EventCreditTransaction` — журнал движений credits.

---

## Алгоритм проверки доступа к функции

```typescript
async function hasFeature(orgId, featureCode): boolean {
  const entitlement = await db.query.organizationFeatures.findFirst({
    where: and(
      eq(organizationFeatures.organizationId, orgId),
      eq(organizationFeatures.featureCode, featureCode),
      eq(organizationFeatures.enabled, true),
      or(isNull(organizationFeatures.endsAt), gt(organizationFeatures.endsAt, sql`now()`)),
    ),
  })
  return Boolean(entitlement)
}
```

`OrganizationFeature` создаётся:

1. При активации подписки на plan → создаются записи для всех `PlanFeature` этого plan.
2. При покупке add-on → создаётся одна запись с `source: 'addon'`.
3. При trial / admin_grant → создаётся вручную.

---

## Список фич (catalog)

| Code                     | Module        | Description                                | Enabled by default   |
| ------------------------ | ------------- | ------------------------------------------ | -------------------- |
| `events_basic`           | events        | Создание тренировок и open games           | Yes (core)           |
| `bookings_basic`         | bookings      | Запись игроков, waitlist                   | Yes (core)           |
| `subscriptions`          | subscriptions | Абонементы 4x/8x/12x                       | Yes (core)           |
| `manual_payments`        | payments      | Ручное подтверждение оплат                 | Yes (core)           |
| `ledger_basic`           | ledger        | Касса с базовыми категориями               | Yes (core)           |
| `event_credits`          | credits       | Учёт event credits организации             | Yes (core)           |
| `notifications_telegram` | notifications | Уведомления через Telegram                 | Yes (core)           |
| `invite_links`           | invites       | Ссылки для приглашения                     | Yes (core)           |
| `contributions`          | contributions | Сборы (Phase 11)                           | No (paid)            |
| `online_payments`        | payments      | bePaid интеграция (Phase 12-13)            | No (addon)           |
| `reports_advanced`       | reports       | Отчёты и CSV-экспорт (Phase 14)            | No (Club+)           |
| `reminders_advanced`     | scheduler     | Auto-reminders (Phase 15)                  | No (Club+)           |
| `tournaments`            | tournaments   | Турнирный модуль (Phase 17)                | No (Tournament tier) |
| `live_scoreboard`        | matches       | Live scoreboard (Phase 16)                 | No (Tournament tier) |
| `crm_pro`                | crm           | Расширенная работа с базой (Phase 18)      | No (addon)           |
| `public_page`            | organizations | Публичная страница организации (Phase 11+) | No (Club+)           |
| `multiple_assistants`    | members       | Несколько ассистентов                      | No (Club+)           |
| `mass_messaging`         | crm           | Рассылки по сегментам (Phase 18)           | No (CRM Pro)         |

---

## Список планов (catalog)

> Реальные цены и наполнение финализируются после Phase 10 (Private Beta).

### Plan: `free` (Phase 3-8)

**Для кого:** все новые организации на старте.

**Цена:** 0 BYN.

**Включено:**

- Все core features
- 5 demo event credits

**Лимиты:**

- 1 организация на пользователя
- 5 событий всего (до покупки credits)

### Plan: `start_by_event` (Phase 7+)

**Для кого:** разовые организаторы.

**Цена:** 5 BYN / credit. Пакеты со скидкой:

- 1 credit = 5 BYN
- 10 credits = 40 BYN (4 BYN/credit)
- 30 credits = 105 BYN (3.5 BYN/credit)
- 100 credits = 300 BYN (3 BYN/credit)

**Включено:** core features.

### Plan: `regular` (Phase 11+)

**Для кого:** организаторы 1-3 событий в неделю.

**Цена:** ~15 BYN / месяц.

**Включено:** core + `contributions` + `reports_advanced` + `reminders_advanced`.

**Лимиты:**

- Безлимит событий
- 1 организация
- 50 активных игроков

### Plan: `club` (Phase 14+)

**Для кого:** клубы с регулярными тренировками.

**Цена:** ~40 BYN / месяц.

**Включено:** Regular + `public_page` + `multiple_assistants`.

**Лимиты:**

- Безлимит событий
- До 3 организаций
- 200 активных игроков

### Plan: `tournament` (Phase 17+)

**Для кого:** организаторы турниров (выбирают вместо или поверх Regular).

**Цена:** ~30 BYN / турнир. Или ~80 BYN / месяц безлимит.

**Включено:** `tournaments` + `live_scoreboard`.

### Plan: `custom` (Phase 14+)

**Для кого:** федерации, сети залов.

**Цена:** по договору.

**Включено:** всё.

---

## Add-ons (catalog)

| Code                    | Feature                      | Price                      | Period          | Phase |
| ----------------------- | ---------------------------- | -------------------------- | --------------- | ----- |
| `online_payments_addon` | `online_payments`            | +20 BYN/мес или 2% оборота | monthly / usage | 13    |
| `crm_pro_addon`         | `crm_pro` + `mass_messaging` | +30 BYN/мес                | monthly         | 18    |
| `public_page_addon`     | `public_page`                | +10 BYN/мес                | monthly         | 11    |

---

## Event Credits подробнее (Phase 7)

### Demo квота

При создании организации автоматически:

```
EventCreditAccount {
  organization_id: <new_org>
  balance: 5
}

EventCreditTransaction {
  type: 'grant'
  amount: +5
  comment: 'Demo quota for new organization'
}
```

### Списание

При создании Event:

```
1. CHECK: account.balance >= 1, else InsufficientCreditsError
2. BEGIN TRANSACTION
3.   Event создан, status = 'planned'
4.   account.balance -= 1
5.   EventCreditTransaction (type='spend', amount=-1, related_event_id)
6. COMMIT
```

### Возврат (refund)

При отмене Event **до открытия записи** (event.status был `planned`, никто не записан):

```
1. account.balance += 1
2. EventCreditTransaction (type='refund', amount=+1, related_event_id)
```

При отмене **после открытия записи** или **после старта** — credit НЕ возвращается. Это сознательный design choice: организатор должен думать перед созданием события.

### Пакеты (Phase 7 UI)

Список пакетов хардкодится в `app_settings`:

```
event_credit_packs: [
  { credits: 1, price: 5.00 },
  { credits: 10, price: 40.00 },
  { credits: 30, price: 105.00 },
  { credits: 100, price: 300.00 }
]
```

В Phase 7 — покупка через ручное подтверждение (как Phase 6 для абонементов).
В Phase 12-13 — через bePaid.

### Admin grants

Root-admin платформы может выдать credits любой организации:

```
EventCreditTransaction {
  type: 'grant'
  amount: +N
  comment: 'Reason'
  created_by_user_id: <root admin id>
}
```

### Audit

Все изменения `EventCreditAccount.balance` происходят **только** через `EventCreditTransaction`. Сам balance — кеш для быстрого чтения. На самом деле = `SUM(amount)` всех транзакций. Проверка целостности — раз в день через scheduler-job (Phase 15).

---

## Будущее: Subscription billing (Phase 14+)

### Lifecycle

```
trial (14 дней)
  ↓
active (платит регулярно)
  ↓
past_due (платёж не прошёл)
  ↓ через 7 дней
suspended (доступ к платным фичам отключён, core остаётся)
  ↓ через 30 дней
cancelled
```

### Прорация (proration)

При смене plan в середине периода:

- Если новый plan дороже — берём пропорционально остаток дней по новой цене.
- Если дешевле — кредитуем разницу в credits.

### Что НЕ реализуем на старте

- Сложные tax rules (НДС, GST).
- Multi-currency (только BYN сначала).
- Invoicing с печатными формами.
- Чарджбэки и dispute resolution.

Это всё — после Phase 14, при появлении реальных запросов.

---

## Open questions

1. **Что делать с organizations, у которых закончились credits?** Заморозить создание событий, но позволить продолжать существующие? Скорее всего да.
2. **Можно ли использовать credits на несколько организаций одного владельца?** На MVP — нет (credits scoped к organization). Решение пересматриваем после Phase 10.
3. **Что делать при удалении организации с positive balance credits?** Заморозить, возможность восстановить в течение 90 дней.
4. **Trial для подписок?** 14 дней по умолчанию. Финальное решение в Phase 14.

---

## Ссылки

- [SAAS_STRATEGY.md](./SAAS_STRATEGY.md)
- [ORGANIZER_MONETIZATION.md](./ORGANIZER_MONETIZATION.md)
- [../DOMAIN.md](../DOMAIN.md)
