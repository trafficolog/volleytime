# W-05 · Карточка события

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Кабинет организатора | Ф1 · Запись и ядро | L | Sonnet | Opus |

## Цель

Управление составом и оплатами.

## Макет

- 4 Кабинет организатора → событие

## Объём

- Состав с «+N»
- Лист ожидания
- Оплаты и доли сбора
- Отмена события с возвратом на баланс

## Критерии приёмки

- [ ] Отмена требует подтверждения и показывает последствия

## Зависимости

**Нужно до начала:** [P-05](../01-platform/P-05-multi-seat-booking.md) Запись на несколько мест, [P-08](../01-platform/P-08-event-balance.md) Баланс событий

**Ждут эту задачу:** нет

## Общий функционал

- **Состав и запись** — Запись игрока и состав у организатора — одни и те же данные и статусы. С этим связаны: [P-05](../01-platform/P-05-multi-seat-booking.md), [M-05](../02-mini-app/M-05-booking-statuses.md), [M-06](../02-mini-app/M-06-event-booking.md), [M-09](../02-mini-app/M-09-cancel-booking.md), [P-04](../01-platform/P-04-event-jobs.md). [Подробнее](../links.md#booking)
- **Сбор суммой** — Цена считается в одном месте и одинаково показывается везде. С этим связаны: [P-03](../01-platform/P-03-pricing.md), [M-07](../02-mini-app/M-07-split-price-event.md), [W-04](../03-organizer-web/W-04-event-create.md), [P-17](../01-platform/P-17-public-event-pages.md), [P-04](../01-platform/P-04-event-jobs.md). [Подробнее](../links.md#split)
- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08](../01-platform/P-08-event-balance.md), [W-01](../03-organizer-web/W-01-cabinet-shell.md), [W-12](../03-organizer-web/W-12-balance-billing.md), [P-06](../01-platform/P-06-event-series.md), [R-02](../04-root-admin/R-02-balance-tariffs.md), [R-03](../04-root-admin/R-03-grant-balance.md), [R-04](../04-root-admin/R-04-subscriptions-payouts.md), [R-08](../04-root-admin/R-08-rename-credits.md). [Подробнее](../links.md#balance)
