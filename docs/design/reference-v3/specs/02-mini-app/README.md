# Mini App

25 задач. Каждая — отдельная спецификация.

| ID | Задача | Сложн. | Модель | Фаза | Зависит от |
|---|---|---|---|---|---|
| [M-01](M-01-telegram-shell.md) | Оболочка Telegram | M | Sonnet | Ф1 | P-11 |
| [M-02](M-02-tab-bar.md) | Таб-бар | S | Haiku | Ф1 | P-02 |
| [M-03](M-03-home-feed.md) | Главная «Лента дня» | L | Sonnet | Ф3 | M-02, P-12 |
| [M-04](M-04-group-switcher.md) | Переключатель групп | S | Haiku | Ф1 | P-01 |
| [M-05](M-05-booking-statuses.md) | Статусы записи | M | Sonnet | Ф1 | — |
| [M-06](M-06-event-booking.md) | Событие и запись | L | Sonnet | Ф1 | P-05, M-05 |
| [M-07](M-07-split-price-event.md) | Событие со сбором суммой | L | Sonnet | Ф1 | P-03, M-06 |
| [M-08](M-08-invite-booking.md) | Запись по приглашению | M | Sonnet | Ф1 | P-07 |
| [M-09](M-09-cancel-booking.md) | Отмена записи | S | Haiku | Ф1 | P-02, P-05 |
| [M-10](M-10-my-calendar.md) | Общий календарь | L | Sonnet | Ф3 | P-01, M-05 |
| [M-11](M-11-group-schedule.md) | Расписание группы | M | Sonnet | Ф2 | M-05 |
| [M-12](M-12-profile-features.md) | Профиль и «Что показывать» | M | Sonnet | Ф3 | P-12 |
| [M-13](M-13-player-screens.md) | Остальные экраны игрока | M | Sonnet | Ф1 | P-15 |
| [M-14](M-14-player-level.md) | Уровень игрока | S | Haiku | Ф1 | P-10 |
| [M-15a](M-15a-ai-coach-agent.md) | AI-тренер · агент | XL | Opus | Ф6 | P-10 |
| [M-15b](M-15b-ai-coach-ui.md) | AI-тренер · экраны | L | Sonnet | Ф6 | M-15a |
| [M-16](M-16-warmup.md) | Разминка | L | Sonnet | Ф5 | W-04 |
| [M-17](M-17-self-check.md) | Самооценка | M | Sonnet | Ф5 | P-09 |
| [M-18](M-18-skill-progress.md) | Прогресс навыков | M | Sonnet | Ф5 | M-17, P-10 |
| [M-19](M-19-team-balancing.md) | Составы на игру | XL | Opus | Ф6 | P-10, M-17 |
| [M-20](M-20-streaks.md) | Серии и челленджи | M | Sonnet | Ф5 | P-04 |
| [M-21](M-21-mvp-vote.md) | MVP игры | M | Sonnet | Ф6 | P-11 |
| [M-22](M-22-season-wrapped.md) | Итоги сезона | M | Sonnet | Ф6 | P-14 |
| [M-23](M-23-org-event-create.md) | Организатор · создание события | L | Sonnet | Ф2 | P-03, P-06, P-07 |
| [M-24](M-24-org-players-report.md) | Организатор · игроки и отчёт | M | Sonnet | Ф2 | P-10 |

[← План](../README.md) · [Роадмап](../roadmap.md) · [Связи](../links.md)