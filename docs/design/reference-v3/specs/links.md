# Связи по общему функционалу

Группы задач, которые делят один контракт, компонент или данные между интерфейсами. Менять такую логику — только вместе со всеми задачами группы.

| Функционал | Платформа | Mini App | Кабинет | Root Admin |
|---|---|---|---|---|
| [Создание события](#create-event) | P-03, P-06, P-07, P-08 | M-23, M-16 | W-04, W-02 | — |
| [Состав и запись](#booking) | P-05, P-04 | M-05, M-06, M-09 | W-05 | — |
| [Сбор суммой](#split) | P-03, P-17, P-04 | M-07 | W-04, W-05 | — |
| [Режим записи и приглашения](#invite) | P-07, P-16 | M-23, M-08 | W-11, W-04, W-14 | — |
| [Баланс событий](#balance) | P-08, P-06 | — | W-01, W-12, W-05 | R-02, R-03, R-04, R-08 |
| [Уровни В1–В4+](#levels) | P-10 | M-14, M-24, M-18, M-19, M-15a | W-06, W-13 | — |
| [Настройки группы](#settings) | P-02 | M-02, M-06, M-09 | W-11, W-09, W-04 | — |
| [Абонементы](#subs) | P-02, P-03 | M-02, M-13 | W-09 | — |
| [Личные функции игрока](#features) | P-12, P-09, P-14 | M-02, M-03, M-12, M-15b, M-16, M-17, M-18, M-19, M-20, M-21, M-22 | — | — |
| [Календари и расписание](#calendar) | P-06 | M-10, M-11 | W-03 | — |
| [Уведомления](#notify) | P-09, P-16 | M-13, M-17 | W-15 | — |
| [Игроки и отчёты](#reports) | — | M-24 | W-06, W-10, W-07 | — |
| [Страница группы](#seo) | P-02 | — | W-13, W-14 | R-06 |
| [Доступ и аудит](#auth) | P-11 | M-01 | W-16 | R-05, R-07, R-03 |
| [Самооценка → прогресс → составы → тренер](#skill-chain) | — | M-17, M-18, M-19, M-15a | — | — |
| [Разминка в событии](#warmup) | — | M-23, M-16, M-03 | W-04 | — |
| [Поиск](#search) | P-13 | — | W-01 | — |

<a id="create-event"></a>
## Создание события

Одна форма и один контракт API в кабинете и в Mini App организатора.

- **Платформа:** [P-03](01-platform/P-03-pricing.md) Расчёт цены, [P-06](01-platform/P-06-event-series.md) Серии событий, [P-07](01-platform/P-07-join-mode-invites.md) Режим записи и приглашения, [P-08](01-platform/P-08-event-balance.md) Баланс событий
- **Mini App:** [M-23](02-mini-app/M-23-org-event-create.md) Организатор · создание события, [M-16](02-mini-app/M-16-warmup.md) Разминка
- **Кабинет организатора:** [W-04](03-organizer-web/W-04-event-create.md) Создание события, [W-02](03-organizer-web/W-02-overview.md) Обзор

```mermaid
graph LR
  W_04["W-04 Создание события"]:::W
  M_23["M-23 Организатор · создание события"]:::M
  W_02["W-02 Обзор"]:::W
  P_03["P-03 Расчёт цены"]:::P
  P_06["P-06 Серии событий"]:::P
  P_07["P-07 Режим записи и приглашения"]:::P
  P_08["P-08 Баланс событий"]:::P
  M_16["M-16 Разминка"]:::M
  P_03 --> W_04
  P_06 --> W_04
  P_07 --> W_04
  P_03 --> M_23
  P_06 --> M_23
  P_07 --> M_23
  P_08 --> P_06
  W_04 --> M_16
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="booking"></a>
## Состав и запись

Запись игрока и состав у организатора — одни и те же данные и статусы.

- **Платформа:** [P-05](01-platform/P-05-multi-seat-booking.md) Запись на несколько мест, [P-04](01-platform/P-04-event-jobs.md) Фоновые задачи по событию
- **Mini App:** [M-05](02-mini-app/M-05-booking-statuses.md) Статусы записи, [M-06](02-mini-app/M-06-event-booking.md) Событие и запись, [M-09](02-mini-app/M-09-cancel-booking.md) Отмена записи
- **Кабинет организатора:** [W-05](03-organizer-web/W-05-event-card.md) Карточка события

```mermaid
graph LR
  P_05["P-05 Запись на несколько мест"]:::P
  M_05["M-05 Статусы записи"]:::M
  M_06["M-06 Событие и запись"]:::M
  M_09["M-09 Отмена записи"]:::M
  W_05["W-05 Карточка события"]:::W
  P_04["P-04 Фоновые задачи по событию"]:::P
  P_05 --> M_06
  M_05 --> M_06
  P_05 --> M_09
  P_05 --> W_05
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="split"></a>
## Сбор суммой

Цена считается в одном месте и одинаково показывается везде.

- **Платформа:** [P-03](01-platform/P-03-pricing.md) Расчёт цены, [P-17](01-platform/P-17-public-event-pages.md) Публичные страницы события, [P-04](01-platform/P-04-event-jobs.md) Фоновые задачи по событию
- **Mini App:** [M-07](02-mini-app/M-07-split-price-event.md) Событие со сбором суммой
- **Кабинет организатора:** [W-04](03-organizer-web/W-04-event-create.md) Создание события, [W-05](03-organizer-web/W-05-event-card.md) Карточка события

```mermaid
graph LR
  P_03["P-03 Расчёт цены"]:::P
  M_07["M-07 Событие со сбором суммой"]:::M
  W_04["W-04 Создание события"]:::W
  W_05["W-05 Карточка события"]:::W
  P_17["P-17 Публичные страницы события"]:::P
  P_04["P-04 Фоновые задачи по событию"]:::P
  P_03 --> M_07
  P_03 --> W_04
  P_03 --> P_17
  P_03 --> P_04
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="invite"></a>
## Режим записи и приглашения

Настройка группы по умолчанию → событие → Mini App и бот.

- **Платформа:** [P-07](01-platform/P-07-join-mode-invites.md) Режим записи и приглашения, [P-16](01-platform/P-16-telegram-bot.md) Telegram-бот
- **Mini App:** [M-23](02-mini-app/M-23-org-event-create.md) Организатор · создание события, [M-08](02-mini-app/M-08-invite-booking.md) Запись по приглашению
- **Кабинет организатора:** [W-11](03-organizer-web/W-11-settings.md) Настройки, [W-04](03-organizer-web/W-04-event-create.md) Создание события, [W-14](03-organizer-web/W-14-group-page-render.md) Страница группы · рендер

```mermaid
graph LR
  P_07["P-07 Режим записи и приглашения"]:::P
  W_11["W-11 Настройки"]:::W
  W_04["W-04 Создание события"]:::W
  M_23["M-23 Организатор · создание события"]:::M
  M_08["M-08 Запись по приглашению"]:::M
  P_16["P-16 Telegram-бот"]:::P
  W_14["W-14 Страница группы · рендер"]:::W
  P_07 --> W_04
  P_07 --> M_23
  P_07 --> M_08
  P_07 --> P_16
  P_07 --> W_14
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="balance"></a>
## Баланс событий

Списания организатора и начисления админа — один журнал.

- **Платформа:** [P-08](01-platform/P-08-event-balance.md) Баланс событий, [P-06](01-platform/P-06-event-series.md) Серии событий
- **Кабинет организатора:** [W-01](03-organizer-web/W-01-cabinet-shell.md) Оболочка кабинета, [W-12](03-organizer-web/W-12-balance-billing.md) Баланс и оплата, [W-05](03-organizer-web/W-05-event-card.md) Карточка события
- **Root Admin:** [R-02](04-root-admin/R-02-balance-tariffs.md) Баланс и тарифы, [R-03](04-root-admin/R-03-grant-balance.md) Выдача баланса, [R-04](04-root-admin/R-04-subscriptions-payouts.md) Подписки и выплаты, [R-08](04-root-admin/R-08-rename-credits.md) Переименование credits

```mermaid
graph LR
  P_08["P-08 Баланс событий"]:::P
  W_01["W-01 Оболочка кабинета"]:::W
  W_12["W-12 Баланс и оплата"]:::W
  P_06["P-06 Серии событий"]:::P
  W_05["W-05 Карточка события"]:::W
  R_02["R-02 Баланс и тарифы"]:::R
  R_03["R-03 Выдача баланса"]:::R
  R_04["R-04 Подписки и выплаты"]:::R
  R_08["R-08 Переименование credits"]:::R
  P_08 --> W_12
  P_08 --> P_06
  P_08 --> W_05
  P_08 --> R_02
  P_08 --> R_03
  P_08 --> R_04
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="levels"></a>
## Уровни В1–В4+

Один справочник для игроков, групп, составов и SEO.

- **Платформа:** [P-10](01-platform/P-10-player-levels.md) Уровни В1–В4+
- **Mini App:** [M-14](02-mini-app/M-14-player-level.md) Уровень игрока, [M-24](02-mini-app/M-24-org-players-report.md) Организатор · игроки и отчёт, [M-18](02-mini-app/M-18-skill-progress.md) Прогресс навыков, [M-19](02-mini-app/M-19-team-balancing.md) Составы на игру, [M-15a](02-mini-app/M-15a-ai-coach-agent.md) AI-тренер · агент
- **Кабинет организатора:** [W-06](03-organizer-web/W-06-players.md) Игроки, [W-13](03-organizer-web/W-13-group-page-builder.md) Страница группы · конструктор

```mermaid
graph LR
  P_10["P-10 Уровни В1–В4+"]:::P
  M_14["M-14 Уровень игрока"]:::M
  W_06["W-06 Игроки"]:::W
  M_24["M-24 Организатор · игроки и отчёт"]:::M
  W_13["W-13 Страница группы · конструктор"]:::W
  M_18["M-18 Прогресс навыков"]:::M
  M_19["M-19 Составы на игру"]:::M
  M_15a["M-15a AI-тренер · агент"]:::M
  P_10 --> M_14
  P_10 --> W_06
  P_10 --> M_24
  P_10 --> W_13
  P_10 --> M_18
  P_10 --> M_19
  P_10 --> M_15a
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="settings"></a>
## Настройки группы

Кабинет задаёт поведение Mini App.

- **Платформа:** [P-02](01-platform/P-02-group-settings.md) Настройки группы
- **Mini App:** [M-02](02-mini-app/M-02-tab-bar.md) Таб-бар, [M-06](02-mini-app/M-06-event-booking.md) Событие и запись, [M-09](02-mini-app/M-09-cancel-booking.md) Отмена записи
- **Кабинет организатора:** [W-11](03-organizer-web/W-11-settings.md) Настройки, [W-09](03-organizer-web/W-09-subscriptions.md) Абонементы, [W-04](03-organizer-web/W-04-event-create.md) Создание события

```mermaid
graph LR
  P_02["P-02 Настройки группы"]:::P
  W_11["W-11 Настройки"]:::W
  W_09["W-09 Абонементы"]:::W
  M_02["M-02 Таб-бар"]:::M
  M_06["M-06 Событие и запись"]:::M
  M_09["M-09 Отмена записи"]:::M
  W_04["W-04 Создание события"]:::W
  P_02 --> W_11
  P_02 --> W_09
  P_02 --> M_02
  P_02 --> M_09
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="subs"></a>
## Абонементы

Выключатель в кабинете скрывает вкладку и продажу в Mini App.

- **Платформа:** [P-02](01-platform/P-02-group-settings.md) Настройки группы, [P-03](01-platform/P-03-pricing.md) Расчёт цены
- **Mini App:** [M-02](02-mini-app/M-02-tab-bar.md) Таб-бар, [M-13](02-mini-app/M-13-player-screens.md) Остальные экраны игрока
- **Кабинет организатора:** [W-09](03-organizer-web/W-09-subscriptions.md) Абонементы

```mermaid
graph LR
  W_09["W-09 Абонементы"]:::W
  M_02["M-02 Таб-бар"]:::M
  M_13["M-13 Остальные экраны игрока"]:::M
  P_02["P-02 Настройки группы"]:::P
  P_03["P-03 Расчёт цены"]:::P
  P_02 --> W_09
  P_02 --> M_02
  P_02 --> P_03
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="features"></a>
## Личные функции игрока

Флаги управляют главной, таб-баром, уведомлениями и гипотезами.

- **Платформа:** [P-12](01-platform/P-12-player-features.md) Личные функции игрока, [P-09](01-platform/P-09-bot-notifications.md) Уведомления через бота, [P-14](01-platform/P-14-feature-analytics.md) Аналитика гипотез
- **Mini App:** [M-02](02-mini-app/M-02-tab-bar.md) Таб-бар, [M-03](02-mini-app/M-03-home-feed.md) Главная «Лента дня», [M-12](02-mini-app/M-12-profile-features.md) Профиль и «Что показывать», [M-15b](02-mini-app/M-15b-ai-coach-ui.md) AI-тренер · экраны, [M-16](02-mini-app/M-16-warmup.md) Разминка, [M-17](02-mini-app/M-17-self-check.md) Самооценка, [M-18](02-mini-app/M-18-skill-progress.md) Прогресс навыков, [M-19](02-mini-app/M-19-team-balancing.md) Составы на игру, [M-20](02-mini-app/M-20-streaks.md) Серии и челленджи, [M-21](02-mini-app/M-21-mvp-vote.md) MVP игры, [M-22](02-mini-app/M-22-season-wrapped.md) Итоги сезона

```mermaid
graph LR
  P_12["P-12 Личные функции игрока"]:::P
  M_02["M-02 Таб-бар"]:::M
  M_03["M-03 Главная «Лента дня»"]:::M
  M_12["M-12 Профиль и «Что показывать»"]:::M
  P_09["P-09 Уведомления через бота"]:::P
  P_14["P-14 Аналитика гипотез"]:::P
  M_15b["M-15b AI-тренер · экраны"]:::M
  M_16["M-16 Разминка"]:::M
  M_17["M-17 Самооценка"]:::M
  M_18["M-18 Прогресс навыков"]:::M
  M_19["M-19 Составы на игру"]:::M
  M_20["M-20 Серии и челленджи"]:::M
  M_21["M-21 MVP игры"]:::M
  M_22["M-22 Итоги сезона"]:::M
  M_02 --> M_03
  P_12 --> M_03
  P_12 --> M_12
  P_12 --> P_14
  P_09 --> M_17
  M_17 --> M_18
  M_17 --> M_19
  P_14 --> M_22
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="calendar"></a>
## Календари и расписание

Общий календарь игрока, расписание группы и календарь кабинета читают одни события.

- **Платформа:** [P-06](01-platform/P-06-event-series.md) Серии событий
- **Mini App:** [M-10](02-mini-app/M-10-my-calendar.md) Общий календарь, [M-11](02-mini-app/M-11-group-schedule.md) Расписание группы
- **Кабинет организатора:** [W-03](03-organizer-web/W-03-events.md) События

```mermaid
graph LR
  M_10["M-10 Общий календарь"]:::M
  M_11["M-11 Расписание группы"]:::M
  W_03["W-03 События"]:::W
  P_06["P-06 Серии событий"]:::P
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="notify"></a>
## Уведомления

Бот, лента Mini App и лента кабинета — один источник.

- **Платформа:** [P-09](01-platform/P-09-bot-notifications.md) Уведомления через бота, [P-16](01-platform/P-16-telegram-bot.md) Telegram-бот
- **Mini App:** [M-13](02-mini-app/M-13-player-screens.md) Остальные экраны игрока, [M-17](02-mini-app/M-17-self-check.md) Самооценка
- **Кабинет организатора:** [W-15](03-organizer-web/W-15-notifications.md) Уведомления кабинета

```mermaid
graph LR
  P_09["P-09 Уведомления через бота"]:::P
  P_16["P-16 Telegram-бот"]:::P
  W_15["W-15 Уведомления кабинета"]:::W
  M_13["M-13 Остальные экраны игрока"]:::M
  M_17["M-17 Самооценка"]:::M
  P_09 --> P_16
  P_09 --> W_15
  P_09 --> M_17
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="reports"></a>
## Игроки и отчёты

Одни цифры в кабинете и в Mini App организатора.

- **Mini App:** [M-24](02-mini-app/M-24-org-players-report.md) Организатор · игроки и отчёт
- **Кабинет организатора:** [W-06](03-organizer-web/W-06-players.md) Игроки, [W-10](03-organizer-web/W-10-reports.md) Отчёты, [W-07](03-organizer-web/W-07-cashbox.md) Касса

```mermaid
graph LR
  W_06["W-06 Игроки"]:::W
  W_10["W-10 Отчёты"]:::W
  W_07["W-07 Касса"]:::W
  M_24["M-24 Организатор · игроки и отчёт"]:::M
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="seo"></a>
## Страница группы

Конструктор организатора, рендер и модерация root.

- **Платформа:** [P-02](01-platform/P-02-group-settings.md) Настройки группы
- **Кабинет организатора:** [W-13](03-organizer-web/W-13-group-page-builder.md) Страница группы · конструктор, [W-14](03-organizer-web/W-14-group-page-render.md) Страница группы · рендер
- **Root Admin:** [R-06](04-root-admin/R-06-group-page-moderation.md) Модерация страниц групп

```mermaid
graph LR
  W_13["W-13 Страница группы · конструктор"]:::W
  W_14["W-14 Страница группы · рендер"]:::W
  R_06["R-06 Модерация страниц групп"]:::R
  P_02["P-02 Настройки группы"]:::P
  P_02 --> W_13
  W_13 --> W_14
  W_14 --> R_06
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="auth"></a>
## Доступ и аудит

Права и журнал для всех интерфейсов.

- **Платформа:** [P-11](01-platform/P-11-auth-roles.md) Авторизация и роли
- **Mini App:** [M-01](02-mini-app/M-01-telegram-shell.md) Оболочка Telegram
- **Кабинет организатора:** [W-16](03-organizer-web/W-16-auth.md) Авторизация
- **Root Admin:** [R-05](04-root-admin/R-05-platform-settings.md) Настройки платформы, [R-07](04-root-admin/R-07-audit-log.md) Журнал действий, [R-03](04-root-admin/R-03-grant-balance.md) Выдача баланса

```mermaid
graph LR
  P_11["P-11 Авторизация и роли"]:::P
  W_16["W-16 Авторизация"]:::W
  M_01["M-01 Оболочка Telegram"]:::M
  R_05["R-05 Настройки платформы"]:::R
  R_07["R-07 Журнал действий"]:::R
  R_03["R-03 Выдача баланса"]:::R
  P_11 --> W_16
  P_11 --> M_01
  P_11 --> R_05
  P_11 --> R_07
  R_07 --> R_03
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="skill-chain"></a>
## Самооценка → прогресс → составы → тренер

Данные самооценки питают прогресс, балансировку и план тренера.

- **Mini App:** [M-17](02-mini-app/M-17-self-check.md) Самооценка, [M-18](02-mini-app/M-18-skill-progress.md) Прогресс навыков, [M-19](02-mini-app/M-19-team-balancing.md) Составы на игру, [M-15a](02-mini-app/M-15a-ai-coach-agent.md) AI-тренер · агент

```mermaid
graph LR
  M_17["M-17 Самооценка"]:::M
  M_18["M-18 Прогресс навыков"]:::M
  M_19["M-19 Составы на игру"]:::M
  M_15a["M-15a AI-тренер · агент"]:::M
  M_17 --> M_18
  M_17 --> M_19
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="warmup"></a>
## Разминка в событии

Организатор включает разминку в событие, игрок видит и пропускает её.

- **Mini App:** [M-23](02-mini-app/M-23-org-event-create.md) Организатор · создание события, [M-16](02-mini-app/M-16-warmup.md) Разминка, [M-03](02-mini-app/M-03-home-feed.md) Главная «Лента дня»
- **Кабинет организатора:** [W-04](03-organizer-web/W-04-event-create.md) Создание события

```mermaid
graph LR
  W_04["W-04 Создание события"]:::W
  M_23["M-23 Организатор · создание события"]:::M
  M_16["M-16 Разминка"]:::M
  M_03["M-03 Главная «Лента дня»"]:::M
  W_04 --> M_16
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

<a id="search"></a>
## Поиск

Поиск топбара кабинета.

- **Платформа:** [P-13](01-platform/P-13-cabinet-search.md) Поиск кабинета
- **Кабинет организатора:** [W-01](03-organizer-web/W-01-cabinet-shell.md) Оболочка кабинета

```mermaid
graph LR
  P_13["P-13 Поиск кабинета"]:::P
  W_01["W-01 Оболочка кабинета"]:::W
  P_13 --> W_01
  classDef P fill:#E8ECFF,stroke:#1F2E96
  classDef M fill:#FFF0E6,stroke:#FF6B1F
  classDef W fill:#E9F7EE,stroke:#2E9E5B
  classDef R fill:#F1F1F4,stroke:#666
```

Цвет: синий — платформа, оранжевый — Mini App, зелёный — кабинет, серый — Root Admin.

[← План](README.md) · [Роадмап](roadmap.md)