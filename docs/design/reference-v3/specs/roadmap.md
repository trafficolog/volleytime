# Роадмап

Фазы идут по порядку; внутри фазы задачи без взаимных зависимостей делаются параллельно. Ф3 и Ф4 можно вести одновременно.

## Ф0 · Фундамент

Схема данных, права, настройки группы, токены. Без этого ни одна задача не начинается.

Задач: 6 · XL 2 · L 0 · M 2 · S 2

**Платформа:** [P-15](01-platform/P-15-design-tokens.md) Дизайн-токены и ассеты (S · Haiku); [P-01](01-platform/P-01-domain-model.md) Доменная модель (XL · Opus); [P-11](01-platform/P-11-auth-roles.md) Авторизация и роли (XL · Opus); [P-02](01-platform/P-02-group-settings.md) Настройки группы (M · Sonnet); [P-10](01-platform/P-10-player-levels.md) Уровни В1–В4+ (M · Sonnet)

**Root Admin:** [R-08](04-root-admin/R-08-rename-credits.md) Переименование credits (S · Haiku)

```mermaid
graph LR
  P_15["P-15 Дизайн-токены и ассеты"]
  P_01["P-01 Доменная модель"]
  P_11["P-11 Авторизация и роли"]
  P_02["P-02 Настройки группы"]
  P_10["P-10 Уровни В1–В4+"]
  R_08["R-08 Переименование credits"]
  P_01 --> P_11
  P_01 --> P_02
  P_01 --> P_10
  classDef done fill:#eee,stroke:#bbb,color:#666
```

## Ф1 · Запись и ядро

Игрок записывается и платит в Mini App, организатор создаёт событие и серию в кабинете. Это первый релиз.

Задач: 26 · XL 5 · L 5 · M 12 · S 4

**Платформа:** [P-05](01-platform/P-05-multi-seat-booking.md) Запись на несколько мест (XL · Opus); [P-03](01-platform/P-03-pricing.md) Расчёт цены (XL · Opus); [P-04](01-platform/P-04-event-jobs.md) Фоновые задачи по событию (XL · Opus); [P-07](01-platform/P-07-join-mode-invites.md) Режим записи и приглашения (M · Sonnet); [P-08](01-platform/P-08-event-balance.md) Баланс событий (XL · Opus); [P-06](01-platform/P-06-event-series.md) Серии событий (XL · Opus); [P-09](01-platform/P-09-bot-notifications.md) Уведомления через бота (M · Sonnet); [P-16](01-platform/P-16-telegram-bot.md) Telegram-бот (M · Sonnet); [P-17](01-platform/P-17-public-event-pages.md) Публичные страницы события (M · Sonnet); [P-13](01-platform/P-13-cabinet-search.md) Поиск кабинета (M · Sonnet)

**Mini App:** [M-01](02-mini-app/M-01-telegram-shell.md) Оболочка Telegram (M · Sonnet); [M-02](02-mini-app/M-02-tab-bar.md) Таб-бар (S · Haiku); [M-04](02-mini-app/M-04-group-switcher.md) Переключатель групп (S · Haiku); [M-05](02-mini-app/M-05-booking-statuses.md) Статусы записи (M · Sonnet); [M-06](02-mini-app/M-06-event-booking.md) Событие и запись (L · Sonnet); [M-07](02-mini-app/M-07-split-price-event.md) Событие со сбором суммой (L · Sonnet); [M-08](02-mini-app/M-08-invite-booking.md) Запись по приглашению (M · Sonnet); [M-09](02-mini-app/M-09-cancel-booking.md) Отмена записи (S · Haiku); [M-13](02-mini-app/M-13-player-screens.md) Остальные экраны игрока (M · Sonnet); [M-14](02-mini-app/M-14-player-level.md) Уровень игрока (S · Haiku)

**Кабинет организатора:** [W-16](03-organizer-web/W-16-auth.md) Авторизация (M · Sonnet); [W-01](03-organizer-web/W-01-cabinet-shell.md) Оболочка кабинета (M · Sonnet); [W-03](03-organizer-web/W-03-events.md) События (M · Sonnet); [W-04](03-organizer-web/W-04-event-create.md) Создание события (L · Sonnet); [W-05](03-organizer-web/W-05-event-card.md) Карточка события (L · Sonnet); [W-11](03-organizer-web/W-11-settings.md) Настройки (L · Sonnet)

```mermaid
graph LR
  P_01["P-01 Доменная модель"]:::done
  P_02["P-02 Настройки группы"]:::done
  P_11["P-11 Авторизация и роли"]:::done
  P_15["P-15 Дизайн-токены и ассеты"]:::done
  P_10["P-10 Уровни В1–В4+"]:::done
  P_05["P-05 Запись на несколько мест"]
  P_03["P-03 Расчёт цены"]
  P_04["P-04 Фоновые задачи по событию"]
  P_07["P-07 Режим записи и приглашения"]
  P_08["P-08 Баланс событий"]
  P_06["P-06 Серии событий"]
  P_09["P-09 Уведомления через бота"]
  P_16["P-16 Telegram-бот"]
  P_17["P-17 Публичные страницы события"]
  M_01["M-01 Оболочка Telegram"]
  M_02["M-02 Таб-бар"]
  M_04["M-04 Переключатель групп"]
  M_05["M-05 Статусы записи"]
  M_06["M-06 Событие и запись"]
  M_07["M-07 Событие со сбором суммой"]
  M_08["M-08 Запись по приглашению"]
  M_09["M-09 Отмена записи"]
  M_13["M-13 Остальные экраны игрока"]
  M_14["M-14 Уровень игрока"]
  W_16["W-16 Авторизация"]
  P_13["P-13 Поиск кабинета"]
  W_01["W-01 Оболочка кабинета"]
  W_03["W-03 События"]
  W_04["W-04 Создание события"]
  W_05["W-05 Карточка события"]
  W_11["W-11 Настройки"]
  P_01 --> P_05
  P_02 --> P_05
  P_01 --> P_03
  P_02 --> P_03
  P_03 --> P_04
  P_02 --> P_07
  P_01 --> P_08
  P_01 --> P_06
  P_08 --> P_06
  P_04 --> P_09
  P_07 --> P_16
  P_09 --> P_16
  P_03 --> P_17
  P_11 --> M_01
  P_02 --> M_02
  P_01 --> M_04
  P_05 --> M_06
  M_05 --> M_06
  P_03 --> M_07
  M_06 --> M_07
  P_07 --> M_08
  P_02 --> M_09
  P_05 --> M_09
  P_15 --> M_13
  P_10 --> M_14
  P_11 --> W_16
  P_01 --> P_13
  P_13 --> W_01
  P_15 --> W_01
  P_01 --> W_03
  P_03 --> W_04
  P_06 --> W_04
  P_07 --> W_04
  P_05 --> W_05
  P_08 --> W_05
  P_02 --> W_11
  classDef done fill:#eee,stroke:#bbb,color:#666
```

## Ф2 · Кабинет, Mini App организатора, Root Admin

Все разделы кабинета, режим организатора в Mini App, управление платформой.

Задач: 17 · XL 1 · L 2 · M 12 · S 2

**Mini App:** [M-11](02-mini-app/M-11-group-schedule.md) Расписание группы (M · Sonnet); [M-23](02-mini-app/M-23-org-event-create.md) Организатор · создание события (L · Sonnet); [M-24](02-mini-app/M-24-org-players-report.md) Организатор · игроки и отчёт (M · Sonnet)

**Кабинет организатора:** [W-02](03-organizer-web/W-02-overview.md) Обзор (S · Haiku); [W-06](03-organizer-web/W-06-players.md) Игроки (M · Sonnet); [W-07](03-organizer-web/W-07-cashbox.md) Касса (M · Sonnet); [W-08](03-organizer-web/W-08-collections.md) Сборы (M · Sonnet); [W-09](03-organizer-web/W-09-subscriptions.md) Абонементы (M · Sonnet); [W-10](03-organizer-web/W-10-reports.md) Отчёты (M · Sonnet); [W-12](03-organizer-web/W-12-balance-billing.md) Баланс и оплата (M · Sonnet); [W-15](03-organizer-web/W-15-notifications.md) Уведомления кабинета (S · Haiku)

**Root Admin:** [R-07](04-root-admin/R-07-audit-log.md) Журнал действий (M · Sonnet); [R-01](04-root-admin/R-01-organizations.md) Организации (M · Sonnet); [R-02](04-root-admin/R-02-balance-tariffs.md) Баланс и тарифы (M · Sonnet); [R-03](04-root-admin/R-03-grant-balance.md) Выдача баланса (M · Sonnet); [R-04](04-root-admin/R-04-subscriptions-payouts.md) Подписки и выплаты (XL · Opus); [R-05](04-root-admin/R-05-platform-settings.md) Настройки платформы (L · Sonnet)

```mermaid
graph LR
  W_03["W-03 События"]:::done
  P_10["P-10 Уровни В1–В4+"]:::done
  P_01["P-01 Доменная модель"]:::done
  P_02["P-02 Настройки группы"]:::done
  P_08["P-08 Баланс событий"]:::done
  P_09["P-09 Уведомления через бота"]:::done
  M_05["M-05 Статусы записи"]:::done
  P_03["P-03 Расчёт цены"]:::done
  P_06["P-06 Серии событий"]:::done
  P_07["P-07 Режим записи и приглашения"]:::done
  P_11["P-11 Авторизация и роли"]:::done
  W_02["W-02 Обзор"]
  W_06["W-06 Игроки"]
  W_07["W-07 Касса"]
  W_08["W-08 Сборы"]
  W_09["W-09 Абонементы"]
  W_10["W-10 Отчёты"]
  W_12["W-12 Баланс и оплата"]
  W_15["W-15 Уведомления кабинета"]
  M_11["M-11 Расписание группы"]
  M_23["M-23 Организатор · создание события"]
  M_24["M-24 Организатор · игроки и отчёт"]
  R_07["R-07 Журнал действий"]
  R_01["R-01 Организации"]
  R_02["R-02 Баланс и тарифы"]
  R_03["R-03 Выдача баланса"]
  R_04["R-04 Подписки и выплаты"]
  R_05["R-05 Настройки платформы"]
  W_03 --> W_02
  P_10 --> W_06
  P_01 --> W_07
  P_01 --> W_08
  P_02 --> W_09
  P_01 --> W_10
  P_08 --> W_12
  P_09 --> W_15
  M_05 --> M_11
  P_03 --> M_23
  P_06 --> M_23
  P_07 --> M_23
  P_10 --> M_24
  P_11 --> R_07
  P_01 --> R_01
  P_08 --> R_02
  P_08 --> R_03
  R_07 --> R_03
  P_08 --> R_04
  P_11 --> R_05
  classDef done fill:#eee,stroke:#bbb,color:#666
```

## Ф3 · Вариант A: личные функции и календарь

Главная «Лента дня», общий календарь, экран «Что показывать». Готовит место для гипотез.

Задач: 5 · XL 0 · L 2 · M 3 · S 0

**Платформа:** [P-12](01-platform/P-12-player-features.md) Личные функции игрока (M · Sonnet); [P-14](01-platform/P-14-feature-analytics.md) Аналитика гипотез (M · Sonnet)

**Mini App:** [M-03](02-mini-app/M-03-home-feed.md) Главная «Лента дня» (L · Sonnet); [M-10](02-mini-app/M-10-my-calendar.md) Общий календарь (L · Sonnet); [M-12](02-mini-app/M-12-profile-features.md) Профиль и «Что показывать» (M · Sonnet)

```mermaid
graph LR
  P_11["P-11 Авторизация и роли"]:::done
  M_02["M-02 Таб-бар"]:::done
  P_01["P-01 Доменная модель"]:::done
  M_05["M-05 Статусы записи"]:::done
  P_12["P-12 Личные функции игрока"]
  P_14["P-14 Аналитика гипотез"]
  M_03["M-03 Главная «Лента дня»"]
  M_10["M-10 Общий календарь"]
  M_12["M-12 Профиль и «Что показывать»"]
  P_11 --> P_12
  P_12 --> P_14
  M_02 --> M_03
  P_12 --> M_03
  P_01 --> M_10
  M_05 --> M_10
  P_12 --> M_12
  classDef done fill:#eee,stroke:#bbb,color:#666
```

## Ф4 · SEO-страницы групп

Конструктор, серверный рендер и модерация. Можно вести параллельно с Ф3.

Задач: 3 · XL 1 · L 1 · M 1 · S 0

**Кабинет организатора:** [W-13](03-organizer-web/W-13-group-page-builder.md) Страница группы · конструктор (L · Sonnet); [W-14](03-organizer-web/W-14-group-page-render.md) Страница группы · рендер (XL · Opus)

**Root Admin:** [R-06](04-root-admin/R-06-group-page-moderation.md) Модерация страниц групп (M · Sonnet)

```mermaid
graph LR
  P_02["P-02 Настройки группы"]:::done
  P_10["P-10 Уровни В1–В4+"]:::done
  P_07["P-07 Режим записи и приглашения"]:::done
  W_13["W-13 Страница группы · конструктор"]
  W_14["W-14 Страница группы · рендер"]
  R_06["R-06 Модерация страниц групп"]
  P_02 --> W_13
  P_10 --> W_13
  W_13 --> W_14
  P_07 --> W_14
  W_14 --> R_06
  classDef done fill:#eee,stroke:#bbb,color:#666
```

## Ф5 · Гипотезы · волна 1

Дешёвые гипотезы без LLM. Каждая за флагом, решение по метрикам P-14.

Задач: 4 · XL 0 · L 1 · M 3 · S 0

**Mini App:** [M-16](02-mini-app/M-16-warmup.md) Разминка (L · Sonnet); [M-17](02-mini-app/M-17-self-check.md) Самооценка (M · Sonnet); [M-18](02-mini-app/M-18-skill-progress.md) Прогресс навыков (M · Sonnet); [M-20](02-mini-app/M-20-streaks.md) Серии и челленджи (M · Sonnet)

```mermaid
graph LR
  W_04["W-04 Создание события"]:::done
  P_09["P-09 Уведомления через бота"]:::done
  P_10["P-10 Уровни В1–В4+"]:::done
  P_04["P-04 Фоновые задачи по событию"]:::done
  M_16["M-16 Разминка"]
  M_17["M-17 Самооценка"]
  M_18["M-18 Прогресс навыков"]
  M_20["M-20 Серии и челленджи"]
  W_04 --> M_16
  P_09 --> M_17
  M_17 --> M_18
  P_10 --> M_18
  P_04 --> M_20
  classDef done fill:#eee,stroke:#bbb,color:#666
```

## Ф6 · Гипотезы · волна 2

Гипотезы с алгоритмами и LLM. Стартуют, когда волна 1 дала данные самооценки.

Задач: 5 · XL 2 · L 1 · M 2 · S 0

**Mini App:** [M-21](02-mini-app/M-21-mvp-vote.md) MVP игры (M · Sonnet); [M-19](02-mini-app/M-19-team-balancing.md) Составы на игру (XL · Opus); [M-15a](02-mini-app/M-15a-ai-coach-agent.md) AI-тренер · агент (XL · Opus); [M-15b](02-mini-app/M-15b-ai-coach-ui.md) AI-тренер · экраны (L · Sonnet); [M-22](02-mini-app/M-22-season-wrapped.md) Итоги сезона (M · Sonnet)

```mermaid
graph LR
  P_11["P-11 Авторизация и роли"]:::done
  P_10["P-10 Уровни В1–В4+"]:::done
  M_17["M-17 Самооценка"]:::done
  P_14["P-14 Аналитика гипотез"]:::done
  M_21["M-21 MVP игры"]
  M_19["M-19 Составы на игру"]
  M_15a["M-15a AI-тренер · агент"]
  M_15b["M-15b AI-тренер · экраны"]
  M_22["M-22 Итоги сезона"]
  P_11 --> M_21
  P_10 --> M_19
  M_17 --> M_19
  P_10 --> M_15a
  M_15a --> M_15b
  P_14 --> M_22
  classDef done fill:#eee,stroke:#bbb,color:#666
```

## Критический путь

Самая длинная цепочка зависимостей (вес: S 1, M 2, L 3, XL 5):

P-01 Доменная модель → P-02 Настройки группы → P-03 Расчёт цены → P-04 Фоновые задачи по событию → P-09 Уведомления через бота → M-17 Самооценка → M-19 Составы на игру

Задержка любой задачи на этом пути сдвигает финал.

## Сводка по моделям

| Модель | Задач | Где |
|---|---|---|
| Opus | 11 | P-01, P-03, P-04, P-05, P-06, P-08, P-11, M-15a, M-19, W-14, R-04 |
| Sonnet | 47 | P-02, P-07, P-09, P-10, P-12, P-13, P-14, P-16, P-17, M-01, M-03, M-05, M-06, M-07, M-08, M-10, M-11, M-12, M-13, M-15b, M-16, M-17, M-18, M-20, M-21, M-22, M-23, M-24, W-01, W-03, W-04, W-05, W-06, W-07, W-08, W-09, W-10, W-11, W-12, W-13, W-16, R-01, R-02, R-03, R-05, R-06, R-07 |
| Haiku | 8 | P-15, M-02, M-04, M-09, M-14, W-02, W-15, R-08 |

[← План](README.md) · [Связи](links.md)