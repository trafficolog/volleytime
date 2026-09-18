---
id: '8.8'
phase: '8'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-16
status_note: 'Все задачи кроме 8.8.11 (ручной QA в Telegram) закрыты.'
estimated_hours: '24-32'
depends_on: ['3.9', '6.8']
---

# Epic 8.8: Исправления по ревью v0.1.0 — Telegram Mini App + Notifications

**Цель.** Сделать Mini App работоспособным в Telegram: SDK загружается, вход автоматический, deeplink ведёт в нужный экран, тема и кнопки Telegram работают, уведомления доходят в проде с понятными текстами, навигация по разделам есть.

## Контекст

Ревью: `telegram-web-app.js` не подключён → `window.Telegram` нет, `isTelegram` всегда false, вход по initData не выполняется; уведомления в проде не доходят (адрес/секрет internal notify пустые — закрыто маппингом в 3.9.2, остаются дефолтные секреты); `/m/` не маршрутизирует `start_param`; тема Telegram не применяется к токенам; тексты уведомлений без даты в TZ, без события в платёжных, без кнопки; организатор не получает уведомление о новом платеже; нет BackButton/MainButton; вне Telegram — пустой экран вместо входа; нет ErrorState; бот на `/start org_…` не показывает контекст; QA в реальном Telegram не проводился. Навигации между разделами нет (корневая причина 6).

## Definition of Done

- SDK Telegram подключён в `<head>`; `isTelegram` определяется по `initData`
- Web и bot в production не стартуют без `BOT_INTERNAL_URL`/`BOT_INTERNAL_SECRET`/`TELEGRAM_BOT_TOKEN`; сравнение секрета constant-time
- `/m/`: Telegram-вход → `start_param` (`org_<token>` → инвайт, `event_<id>` → событие) → последняя организация → список
- Тема Telegram (`themeParams`, `colorScheme`) маппится на `--vt-*`, реагирует на `themeChanged`
- Уведомления: дата/время в TZ организации, событие в платёжных, кнопка «Открыть» с deeplink; организатор получает «новая оплата ждёт подтверждения»
- BackButton на вложенных экранах, MainButton в ключевых сценариях
- Вне Telegram `/m/` без сессии → `/auth/login`
- ErrorState на всех страницах Mini App; бот `/start org_…` показывает название группы
- Таб-бар игрока/организатора, дашборд группы
- Чеклист ручного QA обновлён

## Задачи

| ID                                                        | Приоритет | Задача                                                                                 | Часов |
| --------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------- | ----: |
| [8.8.1](../tasks/8-8-1-telegram-sdk-script.md)            | P0        | SDK telegram-web-app.js в head; isTelegram по initData                                 |     1 |
| [8.8.2](../tasks/8-8-2-notify-prod-secrets.md)            | P0        | Уведомления в проде: без дефолтных секретов в боте, fail-fast, constant-time сравнение |     1 |
| [8.8.3](../tasks/8-8-3-start-router.md)                   | P1        | Стартовый роутер /m/: вход → start_param → последняя организация                       |     2 |
| [8.8.4](../tasks/8-8-4-telegram-theme.md)                 | P1        | Тема Telegram → токены --vt-*, тёмный режим, themeChanged                              |   1-2 |
| [8.8.5](../tasks/8-8-5-notification-texts.md)             | P1        | Тексты уведомлений: дата в TZ организации, событие/план в платёжных, кнопка «Открыть»  |     2 |
| [8.8.6](../tasks/8-8-6-organizer-payment-notification.md) | P1        | Организатор получает «новая оплата ждёт подтверждения»                                 |     1 |
| [8.8.7](../tasks/8-8-7-back-main-buttons.md)              | P1        | BackButton на вложенных экранах, MainButton в ключевых сценариях                       |   1-2 |
| [8.8.8](../tasks/8-8-8-outside-telegram-fallback.md)      | P1        | Вне Telegram /m/ без сессии → /auth/login                                              |   0.5 |
| [8.8.9](../tasks/8-8-9-error-states.md)                   | P2        | ErrorState и повтор на всех страницах Mini App                                         |     1 |
| [8.8.10](../tasks/8-8-10-bot-start-context.md)            | P2        | Бот: /start org_… показывает название группы и пригласившего                           |     1 |
| [8.8.11](../tasks/8-8-11-manual-qa-checklist.md)          | P2        | Чеклист ручного QA в реальном Telegram (iOS/Android/Desktop)                           |     1 |
| [8.8.12](../tasks/8-8-12-miniapp-navigation.md)           | P1        | Навигация Mini App: таб-бар игрока/организатора, дашборд группы                        |     3 |

## Не делать

- ❌ Push вне Telegram (email) — Phase 13
- ❌ Telegram Payments — Phase 12

## Открытые вопросы

- нет
