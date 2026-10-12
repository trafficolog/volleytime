# M-17 · Самооценка

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Mini App | Ф5 · Гипотезы · волна 1 | M | Sonnet | — |

## Цель

Короткая оценка своей игры после события.

## Макет

- 9.3 Самооценка

## Объём

- Форма на 30 секунд
- Входящие неотвеченные
- Напоминание

## Критерии приёмки

- [ ] Форма доступна до следующей игры

## Зависимости

**Нужно до начала:** [P-09](../01-platform/P-09-bot-notifications.md) Уведомления через бота

**Ждут эту задачу:** [M-18](../02-mini-app/M-18-skill-progress.md) Прогресс навыков, [M-19](../02-mini-app/M-19-team-balancing.md) Составы на игру

## Общий функционал

- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12](../01-platform/P-12-player-features.md), [M-02](../02-mini-app/M-02-tab-bar.md), [M-03](../02-mini-app/M-03-home-feed.md), [M-12](../02-mini-app/M-12-profile-features.md), [P-09](../01-platform/P-09-bot-notifications.md), [P-14](../01-platform/P-14-feature-analytics.md), [M-15b](../02-mini-app/M-15b-ai-coach-ui.md), [M-16](../02-mini-app/M-16-warmup.md), [M-18](../02-mini-app/M-18-skill-progress.md), [M-19](../02-mini-app/M-19-team-balancing.md), [M-20](../02-mini-app/M-20-streaks.md), [M-21](../02-mini-app/M-21-mvp-vote.md), [M-22](../02-mini-app/M-22-season-wrapped.md). [Подробнее](../links.md#features)
- **Уведомления** — Бот, лента Mini App и лента кабинета — один источник. С этим связаны: [P-09](../01-platform/P-09-bot-notifications.md), [P-16](../01-platform/P-16-telegram-bot.md), [W-15](../03-organizer-web/W-15-notifications.md), [M-13](../02-mini-app/M-13-player-screens.md). [Подробнее](../links.md#notify)
- **Самооценка → прогресс → составы → тренер** — Данные самооценки питают прогресс, балансировку и план тренера. С этим связаны: [M-18](../02-mini-app/M-18-skill-progress.md), [M-19](../02-mini-app/M-19-team-balancing.md), [M-15a](../02-mini-app/M-15a-ai-coach-agent.md). [Подробнее](../links.md#skill-chain)
