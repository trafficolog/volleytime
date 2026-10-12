# M-09 · Отмена записи

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Mini App | Ф1 · Запись и ядро | S | Haiku | — |

## Цель

Отмена по правилам группы.

## Макет

- 3 Mini App → событие → отмена

## Объём

- Доступна/недоступна по политике
- «Отменить можно до …»
- Частичная отмена мест

## Критерии приёмки

- [ ] После дедлайна кнопка заменяется пояснением

## Зависимости

**Нужно до начала:** [P-02](../01-platform/P-02-group-settings.md) Настройки группы, [P-05](../01-platform/P-05-multi-seat-booking.md) Запись на несколько мест

**Ждут эту задачу:** нет

## Общий функционал

- **Состав и запись** — Запись игрока и состав у организатора — одни и те же данные и статусы. С этим связаны: [P-05](../01-platform/P-05-multi-seat-booking.md), [M-05](../02-mini-app/M-05-booking-statuses.md), [M-06](../02-mini-app/M-06-event-booking.md), [W-05](../03-organizer-web/W-05-event-card.md), [P-04](../01-platform/P-04-event-jobs.md). [Подробнее](../links.md#booking)
- **Настройки группы** — Кабинет задаёт поведение Mini App. С этим связаны: [P-02](../01-platform/P-02-group-settings.md), [W-11](../03-organizer-web/W-11-settings.md), [W-09](../03-organizer-web/W-09-subscriptions.md), [M-02](../02-mini-app/M-02-tab-bar.md), [M-06](../02-mini-app/M-06-event-booking.md), [W-04](../03-organizer-web/W-04-event-create.md). [Подробнее](../links.md#settings)
