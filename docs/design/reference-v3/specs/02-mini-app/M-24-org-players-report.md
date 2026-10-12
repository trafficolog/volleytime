# M-24 · Организатор · игроки и отчёт

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Mini App | Ф2 · Кабинет, Mini App организатора, Root Admin | M | Sonnet | — |

## Цель

Короткая сводка группы в Mini App.

## Макет

- 3 Mini App → режим организатора → Игроки, Отчёт

## Объём

- Игроки с уровнями
- Отчёт за месяц: события, посещаемость, деньги

## Критерии приёмки

- [ ] Цифры совпадают с W-10

## Зависимости

**Нужно до начала:** [P-10](../01-platform/P-10-player-levels.md) Уровни В1–В4+

**Ждут эту задачу:** нет

## Общий функционал

- **Уровни В1–В4+** — Один справочник для игроков, групп, составов и SEO. С этим связаны: [P-10](../01-platform/P-10-player-levels.md), [M-14](../02-mini-app/M-14-player-level.md), [W-06](../03-organizer-web/W-06-players.md), [W-13](../03-organizer-web/W-13-group-page-builder.md), [M-18](../02-mini-app/M-18-skill-progress.md), [M-19](../02-mini-app/M-19-team-balancing.md), [M-15a](../02-mini-app/M-15a-ai-coach-agent.md). [Подробнее](../links.md#levels)
- **Игроки и отчёты** — Одни цифры в кабинете и в Mini App организатора. С этим связаны: [W-06](../03-organizer-web/W-06-players.md), [W-10](../03-organizer-web/W-10-reports.md), [W-07](../03-organizer-web/W-07-cashbox.md). [Подробнее](../links.md#reports)
