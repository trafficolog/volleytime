# W-04 · Создание события

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Кабинет организатора | Ф1 · Запись и ядро | L | Sonnet | Opus |

## Цель

Одна форма для одного события и серии.

## Макет

- 4 Кабинет организатора → События → Создать

## Объём

- Тип, дата, время, зал
- Основной состав (места) и мест на игрока
- Оплата: фиксированная / сбор суммой
- Запись: свободная / по приглашению — подстановка из группы, пометка «только для этого события», «вернуть как в группе»
- Разминка в составе события и длительность (добавить в макет)
- Повтор серией с предпросмотром дат и списанием баланса

## Критерии приёмки

- [ ] Форма блокирует отправку при нехватке баланса
- [ ] Значения по умолчанию берутся из P-02

## Зависимости

**Нужно до начала:** [P-03](../01-platform/P-03-pricing.md) Расчёт цены, [P-06](../01-platform/P-06-event-series.md) Серии событий, [P-07](../01-platform/P-07-join-mode-invites.md) Режим записи и приглашения

**Ждут эту задачу:** [M-16](../02-mini-app/M-16-warmup.md) Разминка

## Общий функционал

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [M-23](../02-mini-app/M-23-org-event-create.md), [W-02](../03-organizer-web/W-02-overview.md), [P-03](../01-platform/P-03-pricing.md), [P-06](../01-platform/P-06-event-series.md), [P-07](../01-platform/P-07-join-mode-invites.md), [P-08](../01-platform/P-08-event-balance.md), [M-16](../02-mini-app/M-16-warmup.md). [Подробнее](../links.md#create-event)
- **Сбор суммой** — Цена считается в одном месте и одинаково показывается везде. С этим связаны: [P-03](../01-platform/P-03-pricing.md), [M-07](../02-mini-app/M-07-split-price-event.md), [W-05](../03-organizer-web/W-05-event-card.md), [P-17](../01-platform/P-17-public-event-pages.md), [P-04](../01-platform/P-04-event-jobs.md). [Подробнее](../links.md#split)
- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [P-07](../01-platform/P-07-join-mode-invites.md), [W-11](../03-organizer-web/W-11-settings.md), [M-23](../02-mini-app/M-23-org-event-create.md), [M-08](../02-mini-app/M-08-invite-booking.md), [P-16](../01-platform/P-16-telegram-bot.md), [W-14](../03-organizer-web/W-14-group-page-render.md). [Подробнее](../links.md#invite)
- **Настройки группы** — Кабинет задаёт поведение Mini App. С этим связаны: [P-02](../01-platform/P-02-group-settings.md), [W-11](../03-organizer-web/W-11-settings.md), [W-09](../03-organizer-web/W-09-subscriptions.md), [M-02](../02-mini-app/M-02-tab-bar.md), [M-06](../02-mini-app/M-06-event-booking.md), [M-09](../02-mini-app/M-09-cancel-booking.md). [Подробнее](../links.md#settings)
- **Разминка в событии** — Организатор включает разминку в событие, игрок видит и пропускает её. С этим связаны: [M-23](../02-mini-app/M-23-org-event-create.md), [M-16](../02-mini-app/M-16-warmup.md), [M-03](../02-mini-app/M-03-home-feed.md). [Подробнее](../links.md#warmup)
