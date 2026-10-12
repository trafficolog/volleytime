# M-02 · Таб-бар

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Mini App | Ф1 · Запись и ядро | S | Haiku | — |

## Цель

Нижняя навигация, которая подстраивается под группу и игрока.

## Макет

- 3 Mini App → таб-бар

## Объём

- Главная · Календарь · Абонементы · Сборы · Профиль
- «Абонементы» скрыты при subsOn = false
- «Календарь» скрыт при выключенном флаге cal (после P-12)
- Точка у новой вкладки до первого открытия

## Критерии приёмки

- [ ] Не больше 5 вкладок
- [ ] Скрытие вкладки не ломает активную

## Зависимости

**Нужно до начала:** [P-02](../01-platform/P-02-group-settings.md) Настройки группы

**Ждут эту задачу:** [M-03](../02-mini-app/M-03-home-feed.md) Главная «Лента дня»

## Общий функционал

- **Настройки группы** — Кабинет задаёт поведение Mini App. С этим связаны: [P-02](../01-platform/P-02-group-settings.md), [W-11](../03-organizer-web/W-11-settings.md), [W-09](../03-organizer-web/W-09-subscriptions.md), [M-06](../02-mini-app/M-06-event-booking.md), [M-09](../02-mini-app/M-09-cancel-booking.md), [W-04](../03-organizer-web/W-04-event-create.md). [Подробнее](../links.md#settings)
- **Абонементы** — Выключатель в кабинете скрывает вкладку и продажу в Mini App. С этим связаны: [W-09](../03-organizer-web/W-09-subscriptions.md), [M-13](../02-mini-app/M-13-player-screens.md), [P-02](../01-platform/P-02-group-settings.md), [P-03](../01-platform/P-03-pricing.md). [Подробнее](../links.md#subs)
- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12](../01-platform/P-12-player-features.md), [M-03](../02-mini-app/M-03-home-feed.md), [M-12](../02-mini-app/M-12-profile-features.md), [P-09](../01-platform/P-09-bot-notifications.md), [P-14](../01-platform/P-14-feature-analytics.md), [M-15b](../02-mini-app/M-15b-ai-coach-ui.md), [M-16](../02-mini-app/M-16-warmup.md), [M-17](../02-mini-app/M-17-self-check.md), [M-18](../02-mini-app/M-18-skill-progress.md), [M-19](../02-mini-app/M-19-team-balancing.md), [M-20](../02-mini-app/M-20-streaks.md), [M-21](../02-mini-app/M-21-mvp-vote.md), [M-22](../02-mini-app/M-22-season-wrapped.md). [Подробнее](../links.md#features)
