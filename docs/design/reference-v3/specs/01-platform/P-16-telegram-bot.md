# P-16 · Telegram-бот

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Платформа | Ф1 · Запись и ядро | M | Sonnet | — |

## Цель

Бот как вход в Mini App и канал уведомлений.

## Макет

- 2 Telegram Bot

## Объём

- Команды /start, /games, /my
- Inline-кнопки, deep links в Mini App (startapp)
- Только реальные возможности Bot API

## Данные и API

- Webhook, обработчики

## Критерии приёмки

- [ ] Ссылка-приглашение из бота открывает нужное событие

## Зависимости

**Нужно до начала:** [P-07](../01-platform/P-07-join-mode-invites.md) Режим записи и приглашения, [P-09](../01-platform/P-09-bot-notifications.md) Уведомления через бота

**Ждут эту задачу:** нет

## Общий функционал

- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [P-07](../01-platform/P-07-join-mode-invites.md), [W-11](../03-organizer-web/W-11-settings.md), [W-04](../03-organizer-web/W-04-event-create.md), [M-23](../02-mini-app/M-23-org-event-create.md), [M-08](../02-mini-app/M-08-invite-booking.md), [W-14](../03-organizer-web/W-14-group-page-render.md). [Подробнее](../links.md#invite)
- **Уведомления** — Бот, лента Mini App и лента кабинета — один источник. С этим связаны: [P-09](../01-platform/P-09-bot-notifications.md), [W-15](../03-organizer-web/W-15-notifications.md), [M-13](../02-mini-app/M-13-player-screens.md), [M-17](../02-mini-app/M-17-self-check.md). [Подробнее](../links.md#notify)
