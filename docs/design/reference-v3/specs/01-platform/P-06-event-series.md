# P-06 · Серии событий

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Платформа | Ф1 · Запись и ядро | XL | Opus | Opus + тесты |

## Цель

Массовое создание событий по правилу повтора.

## Макет

- 4 Кабинет → Создание события → Повтор
- 3 Mini App → организатор → создание

## Объём

- Правило: дни недели, период (месяц, квартал, год, до даты, N раз)
- Исключения (праздники, отменённые даты)
- Предпросмотр дат перед созданием
- Правка «только это» / «это и последующие»
- Списание баланса за каждое событие серии, проверка достаточности

## Данные и API

- POST /series
- GET /series/{id}/preview
- PATCH /series/{id}?scope=following

## Критерии приёмки

- [ ] Создание серии из 52 событий выполняется одной операцией
- [ ] При нехватке баланса серия не создаётся частично

## Зависимости

**Нужно до начала:** [P-01](../01-platform/P-01-domain-model.md) Доменная модель, [P-08](../01-platform/P-08-event-balance.md) Баланс событий

**Ждут эту задачу:** [M-23](../02-mini-app/M-23-org-event-create.md) Организатор · создание события, [W-04](../03-organizer-web/W-04-event-create.md) Создание события

## Общий функционал

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [W-04](../03-organizer-web/W-04-event-create.md), [M-23](../02-mini-app/M-23-org-event-create.md), [W-02](../03-organizer-web/W-02-overview.md), [P-03](../01-platform/P-03-pricing.md), [P-07](../01-platform/P-07-join-mode-invites.md), [P-08](../01-platform/P-08-event-balance.md), [M-16](../02-mini-app/M-16-warmup.md). [Подробнее](../links.md#create-event)
- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08](../01-platform/P-08-event-balance.md), [W-01](../03-organizer-web/W-01-cabinet-shell.md), [W-12](../03-organizer-web/W-12-balance-billing.md), [W-05](../03-organizer-web/W-05-event-card.md), [R-02](../04-root-admin/R-02-balance-tariffs.md), [R-03](../04-root-admin/R-03-grant-balance.md), [R-04](../04-root-admin/R-04-subscriptions-payouts.md), [R-08](../04-root-admin/R-08-rename-credits.md). [Подробнее](../links.md#balance)
- **Календари и расписание** — Общий календарь игрока, расписание группы и календарь кабинета читают одни события. С этим связаны: [M-10](../02-mini-app/M-10-my-calendar.md), [M-11](../02-mini-app/M-11-group-schedule.md), [W-03](../03-organizer-web/W-03-events.md). [Подробнее](../links.md#calendar)
