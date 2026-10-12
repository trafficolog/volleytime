# P-08 · Баланс событий

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Платформа | Ф1 · Запись и ядро | XL | Opus | Opus + тесты |

## Цель

Предоплаченный баланс организатора: 1 событие = 1 единица.

## Макет

- 4 Кабинет → Баланс и оплата
- 7 Root Admin → Баланс и тарифы

## Объём

- Списание при создании события
- Возврат при отмене события до открытия записи
- Пакеты и покупка
- История операций с причиной
- Порог «баланс заканчивается»

## Данные и API

- Журнал операций (append-only), баланс как сумма
- POST /balance/purchase

## Критерии приёмки

- [ ] Баланс никогда не уходит в минус
- [ ] Каждое изменение баланса имеет запись в журнале и автора

## Зависимости

**Нужно до начала:** [P-01](../01-platform/P-01-domain-model.md) Доменная модель

**Ждут эту задачу:** [P-06](../01-platform/P-06-event-series.md) Серии событий, [W-05](../03-organizer-web/W-05-event-card.md) Карточка события, [W-12](../03-organizer-web/W-12-balance-billing.md) Баланс и оплата, [R-02](../04-root-admin/R-02-balance-tariffs.md) Баланс и тарифы, [R-03](../04-root-admin/R-03-grant-balance.md) Выдача баланса, [R-04](../04-root-admin/R-04-subscriptions-payouts.md) Подписки и выплаты

## Общий функционал

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [W-04](../03-organizer-web/W-04-event-create.md), [M-23](../02-mini-app/M-23-org-event-create.md), [W-02](../03-organizer-web/W-02-overview.md), [P-03](../01-platform/P-03-pricing.md), [P-06](../01-platform/P-06-event-series.md), [P-07](../01-platform/P-07-join-mode-invites.md), [M-16](../02-mini-app/M-16-warmup.md). [Подробнее](../links.md#create-event)
- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [W-01](../03-organizer-web/W-01-cabinet-shell.md), [W-12](../03-organizer-web/W-12-balance-billing.md), [P-06](../01-platform/P-06-event-series.md), [W-05](../03-organizer-web/W-05-event-card.md), [R-02](../04-root-admin/R-02-balance-tariffs.md), [R-03](../04-root-admin/R-03-grant-balance.md), [R-04](../04-root-admin/R-04-subscriptions-payouts.md), [R-08](../04-root-admin/R-08-rename-credits.md). [Подробнее](../links.md#balance)
