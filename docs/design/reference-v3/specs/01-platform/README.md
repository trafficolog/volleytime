# Платформа и бэкенд

25 задач. Каждая — отдельная спецификация.

| ID | Задача | Сложн. | Модель | Фаза | Зависит от |
|---|---|---|---|---|---|
| [P-01](P-01-domain-model.md) | Доменная модель | XL | Opus | Ф0 | — |
| [P-02](P-02-group-settings.md) | Настройки группы | M | Sonnet | Ф0 | P-01 |
| [P-03](P-03-pricing.md) | Расчёт цены | XL | Opus | Ф1 | P-01, P-02 |
| [P-04](P-04-event-jobs.md) | Фоновые задачи по событию | XL | Opus | Ф1 | P-03 |
| [P-05](P-05-multi-seat-booking.md) | Запись на несколько мест | XL | Opus | Ф1 | P-01, P-02 |
| [P-06](P-06-event-series.md) | Серии событий | XL | Opus | Ф1 | P-01, P-08 |
| [P-07](P-07-join-mode-invites.md) | Режим записи и приглашения | M | Sonnet | Ф1 | P-02 |
| [P-08](P-08-event-balance.md) | Баланс событий | XL | Opus | Ф1 | P-01 |
| [P-09](P-09-bot-notifications.md) | Уведомления через бота | M | Sonnet | Ф1 | P-04 |
| [P-10](P-10-player-levels.md) | Уровни В1–В4+ | M | Sonnet | Ф0 | P-01 |
| [P-11](P-11-auth-roles.md) | Авторизация и роли | XL | Opus | Ф0 | P-01 |
| [P-12](P-12-player-features.md) | Личные функции игрока | M | Sonnet | Ф3 | P-11 |
| [P-13](P-13-cabinet-search.md) | Поиск кабинета | M | Sonnet | Ф1 | P-01 |
| [P-14](P-14-feature-analytics.md) | Аналитика гипотез | M | Sonnet | Ф3 | P-12 |
| [P-15](P-15-design-tokens.md) | Дизайн-токены и ассеты | S | Haiku | Ф0 | — |
| [P-16](P-16-telegram-bot.md) | Telegram-бот | M | Sonnet | Ф1 | P-07, P-09 |
| [P-17](P-17-public-event-pages.md) | Публичные страницы события | M | Sonnet | Ф1 | P-03 |
| [P-18](P-18-membership-roles.md) | Членства и матрица ролей | XL | Opus | Ф0 | P-01, P-11 |
| [P-19](P-19-attendance.md) | Посещаемость | L | Sonnet | Ф1 | P-18 |
| [P-20](P-20-payment-claim.md) | «Я оплатил», реквизиты, связь с кассой | L | Opus | Ф1 | P-03, P-18 |
| [P-21](P-21-venues.md) | Справочник залов | M | Sonnet | Ф1 | P-01 |
| [P-22](P-22-support-tickets.md) | Обращения: модель, статусы и сроки | XL | Opus | Ф29 | P-11, P-18, R-07 |
| [P-23](P-23-support-delivery.md) | Ответы поддержки в бот и на email | M | Sonnet | Ф29 | P-22, P-09, P-16 |
| [P-24](P-24-support-attachments.md) | Вложения и контекст обращения | M | Sonnet | Ф29 | P-22 |
| [P-25](P-25-bot-support.md) | Бот · «Помощь» и /support | S | Haiku | Ф29 | P-23, P-16 |

[← План](../README.md) · [Роадмап](../roadmap.md) · [Связи](../links.md)