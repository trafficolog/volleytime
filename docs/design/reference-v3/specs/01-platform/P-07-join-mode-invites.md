# P-07 · Режим записи и приглашения

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Платформа | Ф1 · Запись и ядро | M | Sonnet | — |

## Цель

Свободная запись или по приглашению с наследованием группа → событие.

## Макет

- 4 Кабинет → Настройки и Создание события
- 3 Mini App

## Объём

- Значение группы подставляется в новое событие; событие может переопределить
- Личная ссылка-приглашение (startapp-параметр), срок действия, однократность
- Запрос приглашения от игрока и ответ организатора
- Режим записи не связан с индексацией страницы группы

## Данные и API

- POST /events/{id}/invites
- POST /events/{id}/invite-requests

## Критерии приёмки

- [ ] Без приглашения запись на событие `invite` невозможна через API
- [ ] Изменение настройки группы не меняет созданные события

## Зависимости

**Нужно до начала:** [P-02](../01-platform/P-02-group-settings.md) Настройки группы

**Ждут эту задачу:** [P-16](../01-platform/P-16-telegram-bot.md) Telegram-бот, [M-08](../02-mini-app/M-08-invite-booking.md) Запись по приглашению, [M-23](../02-mini-app/M-23-org-event-create.md) Организатор · создание события, [W-04](../03-organizer-web/W-04-event-create.md) Создание события, [W-14](../03-organizer-web/W-14-group-page-render.md) Страница группы · рендер

## Общий функционал

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [W-04](../03-organizer-web/W-04-event-create.md), [M-23](../02-mini-app/M-23-org-event-create.md), [W-02](../03-organizer-web/W-02-overview.md), [P-03](../01-platform/P-03-pricing.md), [P-06](../01-platform/P-06-event-series.md), [P-08](../01-platform/P-08-event-balance.md), [M-16](../02-mini-app/M-16-warmup.md). [Подробнее](../links.md#create-event)
- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [W-11](../03-organizer-web/W-11-settings.md), [W-04](../03-organizer-web/W-04-event-create.md), [M-23](../02-mini-app/M-23-org-event-create.md), [M-08](../02-mini-app/M-08-invite-booking.md), [P-16](../01-platform/P-16-telegram-bot.md), [W-14](../03-organizer-web/W-14-group-page-render.md). [Подробнее](../links.md#invite)
