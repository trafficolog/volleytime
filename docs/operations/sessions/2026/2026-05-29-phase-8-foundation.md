---
date: 2026-05-29
duration_hours: 2.5
session_type: phase-elaboration
phase: '8'
scope: foundation
goals:
  - 'Начать Phase 8 (MVP-релиз): Telegram foundation'
  - 'Эпики 8.1-8.3 детально (auth, WebApp SDK, bot/deeplinks)'
  - '8.4-8.7 скелетно (notifier+уведомления+полировка+tests → следующая сессия)'
  - 'Фикс: Phase 8 делается ДО Phase 7'
outcomes:
  - 'Phase 8 phase-card переписана: тонкий Telegram-слой поверх 4-6, depends_on 6 не 7'
  - '7 эпиков (3 детально + 4 скелета)'
  - '8 foundation-задач полного формата (1123 строки)'
---

# Сессия 2026-05-29 (Phase 8 foundation): Telegram MVP

## Контекст

Решение пользователя: делать Phase 8 (Telegram Bot + Mini App, путь к MVP) ДО Phase 7 (event credits, блокируется Треком A юридически).

Phase 3-6 расписали всю логику и Mini App страницы. Phase 8 связывает их с Telegram. Разбита на 2 сессии (решение 11). Эта — foundation (8.1-8.3).

## Утверждённые 11 решений

1. Phase 8 = тонкий Telegram-слой поверх готовых страниц 4-6 (НЕ переписываем)
2. WebApp нативные элементы прогрессивно (MainButton ключевые действия, BackButton, theme, haptics)
3. Auth: initData основной + email fallback (браузер)
4. Авто-создание User из Telegram-данных
5. NotifierService абстракция поверх grammY
6. Все отложенные уведомления (booking confirmed, promotion, payment confirmed/rejected, event cancelled, pending→organizer)
7. Fire-and-forget после коммита (очередь с retry — Phase 15)
8. Команды минимум (/start, /help)
9. event_ deeplink да
10. Long-polling (webhook — Phase 9)
11. Разбивка: Сессия 1 foundation (8.1-8.3), Сессия 2 notifier+уведомления+полировка+tests (8.4-8.7)

## Важный фикс зависимости

phase-card 8 имел `depends_on: ["7"]`. Исправлено на `["6"]` — Phase 8 строится на 3-6, НЕ требует Phase 7. Делается раньше.

## Структура Phase 8

### Сессия 1 — Telegram foundation (8 задач, детально)

**Epic 8.1 — Telegram WebApp auth (3 задачи)**

- 8.1.1 initData валидация (HMAC-SHA256 по офиц. алгоритму) + endpoint + тесты
- 8.1.2 авто-создание/связывание User (telegram account provider) + сессия better-auth
- 8.1.3 Mini App auto-login + email fallback (браузер) + loader

**Epic 8.2 — Telegram WebApp SDK (3 задачи)**

- 8.2.1 useTelegram composable (MainButton/BackButton/theme/haptics) + plugin, graceful degradation
- 8.2.2 MainButton/BackButton в ключевые flow (BookingSheet, событие, EventForm, attendance)
- 8.2.3 theme params (light/dark CSS vars) + haptics

**Epic 8.3 — Bot команды + deeplinks (2 задачи)**

- 8.3.1 /start + event_ deeplink (+ публичный preview endpoint) + Mini App кнопки
- 8.3.2 /help + setMyCommands + fallback

### Сессия 2 — скелеты (8.4-8.7)

- 8.4 NotifierService (поверх grammY, fire-and-forget)
- 8.5 Уведомления (все отложенные из 5-6)
- 8.6 UX полировка (loading/error/offline)
- 8.7 Tests + manual QA в реальном Telegram

## Ключевые технические решения

### initData валидация (8.1.1)

Официальный Telegram алгоритм: secret_key = HMAC-SHA256(key="WebAppData", msg=bot_token); сверка hash. Replay protection через auth_date. Критично для безопасности — сверять с офиц. документацией при реализации.

### Auth flow (8.1.2/8.1.3)

В Telegram: initData → валидация → User (telegram account provider, авто-создание) → сессия better-auth → авто-login. Вне Telegram: email fallback (3.4.2). Сессия совместима с tenant middleware (4.5.1).

### WebApp SDK обёртка (8.2.1)

useTelegram composable, no-op вне Telegram (браузерный fallback не ломается). Главная ловушка: MainButton/BackButton глобальны — обязательный cleanup в onUnmounted, offClick перед onClick.

### MainButton стратегия (8.2.2)

Single primary action на экран → MainButton (Записаться, Сохранить, Подтвердить). Списки → in-page кнопки. Реактивный через watchEffect.

### event_ deeplink (8.3.1)

`t.me/bot?start=event_<id>` → публичный preview (без auth, только published) → web_app кнопка на /m/orgs/X/events/Y. Организатор шарит тренировку в чат группы.

## Точки для Сессии 2

- NotifierService вызывается ВНЕ транзакций (после коммита) — в точках 5-6, помеченных «Phase 8»
- Уведомления: booking allocation (5.3.2), promotion (5.6.2), cancel (5.6.1), payment confirm/refund (6.1.3/6.1.4), mass refund (6.4.1)
- Транспорт web→bot: HTTP или общий grammY instance — определить в 8.4.1

## Метрики сессии

- Phase 8 foundation: 8 задач, 1123 строки
- 7 эпиков (3 детально + 4 скелета)
- Все с frontmatter + 6 секций
- phase-card переписана под решения, зависимость исправлена

## Что дальше

### Сессия 2 Phase 8 (следующая)

NotifierService + все уведомления + UX полировка + tests/QA. После неё — MVP готов (критерий: неделя тренировок только через Mini App).

### Параллельные треки (НЕ двигались 7 сессий)

- **Трек A (юридическое):** регистрация ИП/НПД. Блокирует Phase 7, 12-13. Phase 8 не блокирует, но после MVP монетизация (Phase 7) потребует Трек A.
- **Трек B (Python-прототип):** запуск в реальной группе. Можно сейчас — даст UX-валидацию параллельно разработке нового стека.

### После Phase 8

Phase 9 (deploy: webhook, HTTPS, VPS) → Phase 10 (private beta, гейт) → возврат к Phase 7 (event credits, если Трек A созрел).
