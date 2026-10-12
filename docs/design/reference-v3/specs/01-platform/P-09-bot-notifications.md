# P-09 · Уведомления через бота

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Платформа | Ф1 · Запись и ядро | M | Sonnet | — |

## Цель

Своевременные сообщения игрокам и организаторам.

## Макет

- 2 Telegram Bot
- 3 Mini App → Уведомления

## Объём

- Типы: запись открыта, место из очереди, напоминание, итоговая цена сбора, оплата, составы, MVP
- Тихие часы
- Не отправлять уведомления по функциям, выключенным игроком (после P-12)

## Данные и API

- Шаблоны сообщений
- Очередь отправки с учётом лимитов Bot API

## Критерии приёмки

- [ ] Не больше одного уведомления одного типа на событие
- [ ] Отключённые типы не приходят

## Зависимости

**Нужно до начала:** [P-04](../01-platform/P-04-event-jobs.md) Фоновые задачи по событию

**Ждут эту задачу:** [P-16](../01-platform/P-16-telegram-bot.md) Telegram-бот, [M-17](../02-mini-app/M-17-self-check.md) Самооценка, [W-15](../03-organizer-web/W-15-notifications.md) Уведомления кабинета

## Общий функционал

- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12](../01-platform/P-12-player-features.md), [M-02](../02-mini-app/M-02-tab-bar.md), [M-03](../02-mini-app/M-03-home-feed.md), [M-12](../02-mini-app/M-12-profile-features.md), [P-14](../01-platform/P-14-feature-analytics.md), [M-15b](../02-mini-app/M-15b-ai-coach-ui.md), [M-16](../02-mini-app/M-16-warmup.md), [M-17](../02-mini-app/M-17-self-check.md), [M-18](../02-mini-app/M-18-skill-progress.md), [M-19](../02-mini-app/M-19-team-balancing.md), [M-20](../02-mini-app/M-20-streaks.md), [M-21](../02-mini-app/M-21-mvp-vote.md), [M-22](../02-mini-app/M-22-season-wrapped.md). [Подробнее](../links.md#features)
- **Уведомления** — Бот, лента Mini App и лента кабинета — один источник. С этим связаны: [P-16](../01-platform/P-16-telegram-bot.md), [W-15](../03-organizer-web/W-15-notifications.md), [M-13](../02-mini-app/M-13-player-screens.md), [M-17](../02-mini-app/M-17-self-check.md). [Подробнее](../links.md#notify)
