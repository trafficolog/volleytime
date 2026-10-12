# P-12 · Личные функции игрока

| Интерфейс | Фаза | Сложность | Модель | Ревью |
|---|---|---|---|---|
| Платформа | Ф3 · Вариант A: личные функции и календарь | M | Sonnet | — |

## Цель

Игрок сам выбирает, какие функции видит.

## Макет

- 3 Mini App → Профиль → Что показывать

## Объём

- 8 флагов: cal, coach, warmup, self, mvp, teams, streak, wrapped
- По умолчанию всё включено
- Данные выключенной функции не удаляются
- Расписание, запись и оплата не выключаются

## Данные и API

- GET/PATCH /me/features

## Критерии приёмки

- [ ] Флаги сохраняются между сессиями и устройствами

## Зависимости

**Нужно до начала:** [P-11](../01-platform/P-11-auth-roles.md) Авторизация и роли

**Ждут эту задачу:** [P-14](../01-platform/P-14-feature-analytics.md) Аналитика гипотез, [M-03](../02-mini-app/M-03-home-feed.md) Главная «Лента дня», [M-12](../02-mini-app/M-12-profile-features.md) Профиль и «Что показывать»

## Общий функционал

- **Личные функции игрока** — Флаги управляют главной, таб-баром, уведомлениями и гипотезами. С этим связаны: [M-02](../02-mini-app/M-02-tab-bar.md), [M-03](../02-mini-app/M-03-home-feed.md), [M-12](../02-mini-app/M-12-profile-features.md), [P-09](../01-platform/P-09-bot-notifications.md), [P-14](../01-platform/P-14-feature-analytics.md), [M-15b](../02-mini-app/M-15b-ai-coach-ui.md), [M-16](../02-mini-app/M-16-warmup.md), [M-17](../02-mini-app/M-17-self-check.md), [M-18](../02-mini-app/M-18-skill-progress.md), [M-19](../02-mini-app/M-19-team-balancing.md), [M-20](../02-mini-app/M-20-streaks.md), [M-21](../02-mini-app/M-21-mvp-vote.md), [M-22](../02-mini-app/M-22-season-wrapped.md). [Подробнее](../links.md#features)
