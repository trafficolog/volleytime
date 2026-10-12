# M-19 · Составы на игру

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Mini App | Ф6 · Гипотезы · волна 2 | XL | Opus | Opus + тесты |

## Цель

Равные команды без ручного деления.

## Макет

- 9.5 Составы

## Объём

- Алгоритм балансировки по уровню и самооценке
- Учёт нескольких мест у игрока (гости)
- Публикация за час до игры
- Ручная правка организатором

## Критерии приёмки

- [ ] Разница суммарного рейтинга команд ≤ заданного порога
- [ ] Повторный расчёт стабилен

## Зависимости

**Нужно до начала:** [P-10](../01-platform/P-10-player-levels.md) Уровни В1–В4+, [M-17](../02-mini-app/M-17-self-check.md) Самооценка

**Ждут эту задачу:** нет

## Общий функционал

- **Уровни В1–В4+** — Один справочник для игроков, групп, составов и SEO. С этим связаны: [P-10](../01-platform/P-10-player-levels.md), [M-14](../02-mini-app/M-14-player-level.md), [W-06](../03-organizer-web/W-06-players.md), [M-24](../02-mini-app/M-24-org-players-report.md), [W-13](../03-organizer-web/W-13-group-page-builder.md), [M-18](../02-mini-app/M-18-skill-progress.md), [M-15a](../02-mini-app/M-15a-ai-coach-agent.md). [Подробнее](../links.md#levels)
- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [P-12](../01-platform/P-12-player-features.md), [M-02](../02-mini-app/M-02-tab-bar.md), [M-03](../02-mini-app/M-03-home-feed.md), [M-12](../02-mini-app/M-12-profile-features.md), [P-09](../01-platform/P-09-bot-notifications.md), [P-14](../01-platform/P-14-feature-analytics.md), [M-15b](../02-mini-app/M-15b-ai-coach-ui.md), [M-16](../02-mini-app/M-16-warmup.md), [M-17](../02-mini-app/M-17-self-check.md), [M-18](../02-mini-app/M-18-skill-progress.md), [M-20](../02-mini-app/M-20-streaks.md), [M-21](../02-mini-app/M-21-mvp-vote.md), [M-22](../02-mini-app/M-22-season-wrapped.md). [Подробнее](../links.md#features)
- **Самооценка → прогресс → составы → тренер** — Данные самооценки питают прогресс, балансировку и план тренера. С этим связаны: [M-17](../02-mini-app/M-17-self-check.md), [M-18](../02-mini-app/M-18-skill-progress.md), [M-15a](../02-mini-app/M-15a-ai-coach-agent.md). [Подробнее](../links.md#skill-chain)
