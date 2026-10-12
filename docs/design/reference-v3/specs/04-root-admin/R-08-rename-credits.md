# R-08 · Переименование credits

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Root Admin | Ф0 · Фундамент | S | Haiku | — |

## Цель

Единый термин «баланс событий».

## Макет

- 7 Root Admin
- 1 Brand and System

## Объём

- «Credits & тарифы» → «Баланс и тарифы»
- Выдача баланса
- Тексты бренд-системы

## Критерии приёмки

- [ ] grep по «credit» в интерфейсе пуст

## Зависимости

**Нужно до начала:** нет

**Ждут эту задачу:** нет

## Общий функционал

- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08](../01-platform/P-08-event-balance.md), [W-01](../03-organizer-web/W-01-cabinet-shell.md), [W-12](../03-organizer-web/W-12-balance-billing.md), [P-06](../01-platform/P-06-event-series.md), [W-05](../03-organizer-web/W-05-event-card.md), [R-02](../04-root-admin/R-02-balance-tariffs.md), [R-03](../04-root-admin/R-03-grant-balance.md), [R-04](../04-root-admin/R-04-subscriptions-payouts.md). [Подробнее](../links.md#balance)
