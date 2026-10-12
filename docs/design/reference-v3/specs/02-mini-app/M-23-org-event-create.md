# M-23 · Организатор · создание события

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Mini App | Ф2 · Кабинет, Mini App организатора, Root Admin | L | Sonnet | Opus |

## Цель

Создание события с телефона по тем же правилам, что в кабинете.

## Макет

- 3 Mini App → режим организатора

## Объём

- Тип оплаты
- Места и мест на игрока
- Режим записи с наследованием
- Разминка в составе
- Серия

## Критерии приёмки

- [ ] Тот же контракт API, что у W-04

## Зависимости

**Нужно до начала:** [P-03](../01-platform/P-03-pricing.md) Расчёт цены, [P-06](../01-platform/P-06-event-series.md) Серии событий, [P-07](../01-platform/P-07-join-mode-invites.md) Режим записи и приглашения

**Ждут эту задачу:** нет

## Общий функционал

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [W-04](../03-organizer-web/W-04-event-create.md), [W-02](../03-organizer-web/W-02-overview.md), [P-03](../01-platform/P-03-pricing.md), [P-06](../01-platform/P-06-event-series.md), [P-07](../01-platform/P-07-join-mode-invites.md), [P-08](../01-platform/P-08-event-balance.md), [M-16](../02-mini-app/M-16-warmup.md). [Подробнее](../links.md#create-event)
- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [P-07](../01-platform/P-07-join-mode-invites.md), [W-11](../03-organizer-web/W-11-settings.md), [W-04](../03-organizer-web/W-04-event-create.md), [M-08](../02-mini-app/M-08-invite-booking.md), [P-16](../01-platform/P-16-telegram-bot.md), [W-14](../03-organizer-web/W-14-group-page-render.md). [Подробнее](../links.md#invite)
- **Разминка в событии** — Организатор включает разминку в событие, игрок видит и пропускает её. С этим связаны: [W-04](../03-organizer-web/W-04-event-create.md), [M-16](../02-mini-app/M-16-warmup.md), [M-03](../02-mini-app/M-03-home-feed.md). [Подробнее](../links.md#warmup)
