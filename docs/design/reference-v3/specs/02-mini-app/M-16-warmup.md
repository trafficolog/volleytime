# M-16 · Разминка

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Mini App | Ф5 · Гипотезы · волна 1 | L | Sonnet | Opus |

## Цель

Разминка перед игрой или в составе события.

## Макет

- 9.2 Разминка
- 3 Mini App → Главная → карточка разминки

## Объём

- Программы, предпросмотр, таймер, настройки
- Разминка в составе события: карточка «Разминка входит в игру»
- Пропуск одной кнопкой и отмена пропуска
- Подсказка «можно прийти к …»

## Состояния экрана

- Своя до игры
- В составе игры
- Пропущена

## Критерии приёмки

- [ ] Пропуск сохраняется и виден организатору

## Зависимости

**Нужно до начала:** [W-04](../03-organizer-web/W-04-event-create.md) Создание события

**Ждут эту задачу:** нет

## Общий функционал

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [W-04](../03-organizer-web/W-04-event-create.md), [M-23](../02-mini-app/M-23-org-event-create.md), [W-02](../03-organizer-web/W-02-overview.md), [P-03](../01-platform/P-03-pricing.md), [P-06](../01-platform/P-06-event-series.md), [P-07](../01-platform/P-07-join-mode-invites.md), [P-08](../01-platform/P-08-event-balance.md). [Подробнее](../links.md#create-event)
- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12](../01-platform/P-12-player-features.md), [M-02](../02-mini-app/M-02-tab-bar.md), [M-03](../02-mini-app/M-03-home-feed.md), [M-12](../02-mini-app/M-12-profile-features.md), [P-09](../01-platform/P-09-bot-notifications.md), [P-14](../01-platform/P-14-feature-analytics.md), [M-15b](../02-mini-app/M-15b-ai-coach-ui.md), [M-17](../02-mini-app/M-17-self-check.md), [M-18](../02-mini-app/M-18-skill-progress.md), [M-19](../02-mini-app/M-19-team-balancing.md), [M-20](../02-mini-app/M-20-streaks.md), [M-21](../02-mini-app/M-21-mvp-vote.md), [M-22](../02-mini-app/M-22-season-wrapped.md). [Подробнее](../links.md#features)
- **Разминка в событии** — Организатор включает разминку в событие, игрок видит и пропускает её. С этим связаны: [W-04](../03-organizer-web/W-04-event-create.md), [M-23](../02-mini-app/M-23-org-event-create.md), [M-03](../02-mini-app/M-03-home-feed.md). [Подробнее](../links.md#warmup)
