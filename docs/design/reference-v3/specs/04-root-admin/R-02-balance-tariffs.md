# R-02 · Баланс и тарифы

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Root Admin | Ф2 · Кабинет, Mini App организатора, Root Admin | M | Sonnet | — |

## Цель

Пакеты событий платформы.

## Макет

- 7 Root Admin → Credits & тарифы

## Объём

- Пакеты
- Форма «Новый пакет»
- История изменений

## Критерии приёмки

- [ ] Изменение цены не трогает купленные пакеты

## Зависимости

**Нужно до начала:** [P-08](../01-platform/P-08-event-balance.md) Баланс событий

**Ждут эту задачу:** нет

## Общий функционал

- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08](../01-platform/P-08-event-balance.md), [W-01](../03-organizer-web/W-01-cabinet-shell.md), [W-12](../03-organizer-web/W-12-balance-billing.md), [P-06](../01-platform/P-06-event-series.md), [W-05](../03-organizer-web/W-05-event-card.md), [R-03](../04-root-admin/R-03-grant-balance.md), [R-04](../04-root-admin/R-04-subscriptions-payouts.md), [R-08](../04-root-admin/R-08-rename-credits.md). [Подробнее](../links.md#balance)
