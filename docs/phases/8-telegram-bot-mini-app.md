---
id: '8'
status: todo
sync_state: drifted
last_reviewed: 2026-05-29
status_note: 'MVP-RELEASE. Telegram-слой поверх готовых страниц 4-6. РАСПИСАНА ЦЕЛИКОМ (17 задач). Зависит от 3-6, НЕ от 7.'
estimated_hours: '50-70'
depends_on: ['6']
---

# Phase 8: Telegram Bot + Mini App — MVP RELEASE

**Цель.** Связать готовую функциональность (Phase 3-6) с Telegram: Mini App auth через initData, нативные WebApp элементы (MainButton/BackButton/theme/haptics), бот с deeplinks/командами, уведомления. Это MVP, готовый для запуска в реальной группе.

## Контекст

Phase 3-6 расписали всю логику и страницы Mini App (`/m/orgs/...`, события, записи, абонементы, касса, оплаты). Но они существуют как обычные Nuxt-страницы. Phase 8 делает их **по-настоящему Telegram-нативными** и оживляет уведомлениями.

**Важно (решение 1):** Phase 8 НЕ переписывает страницы из 4-6. Это тонкий слой Telegram-интеграции поверх готового UI: initData auth, WebApp SDK обёртка, бот, notifier. Страницы получают нативные элементы (MainButton вместо in-page кнопок для ключевых действий, theme params, haptics), но их разметка/логика/composables уже есть.

Делается ПЕРЕД Phase 7 (event credits) — Phase 8 не блокируется юридически (Трек A), а Phase 7 блокируется. После Phase 8 — работающий продукт.

## Предусловия

- ✅ Phase 3: grammY init (3.5.1), Telegram identity HMAC (3.3.3), Mini App entrypoint (3.4.3), email-логин fallback (3.4.2)
- ✅ Phase 4: grammY deeplink handler для org_ invites (4.4.4)
- ✅ Phase 5-6: страницы Mini App (события, записи, абонементы, касса, оплаты) + отложенные точки уведомлений (booking confirmed, promotion, payment confirm/refund, mass refund)

## Definition of Done

### Сессия 1 — Telegram foundation (эпики 8.1-8.3)

1. ✅ Mini App auth: initData валидация → авто-создание/связывание User → сессия better-auth
2. ✅ Fallback на email-логин если открыто в браузере (вне Telegram)
3. ✅ WebApp SDK обёртка: MainButton, BackButton, theme params, haptic feedback
4. ✅ Ключевые flow используют MainButton (запись, оплата, сохранение события, подтверждение)
5. ✅ Mini App адаптируется под тему пользователя (light/dark из Telegram)
6. ✅ Бот: /start (deeplink org_/event_), /help, кнопка открытия Mini App
7. ✅ event_ deeplink: `t.me/bot?start=event_<id>` → Mini App открывает событие

### Сессия 2 — notifier + уведомления + полировка (эпики 8.4-8.7)

8. ✅ NotifierService (абстракция поверх grammY, fire-and-forget после коммита)
9. ✅ Уведомления: booking confirmed, waitlist promotion, payment confirmed/rejected, event cancelled, pending payment (организатору)
10. ✅ UX полировка: loading/error/offline states под Telegram
11. ✅ Tests + manual QA в реальном Telegram

## Критерий MVP-готовности

✅ Соло-разработчик может провести 1 неделю тренировок в своей группе **только через Mini App**, без Python-прототипа или Excel.

## Архитектура Phase 8

### Новые модули/файлы

```
apps/web/
├── server/api/auth/telegram-miniapp.post.ts  # initData → сессия
├── composables/useTelegram.ts                 # WebApp SDK обёртка
├── plugins/telegram.client.ts                 # инициализация WebApp
└── modules/notifier/                          # NotifierService (сессия 2)

apps/bot/src/
├── handlers/start.ts    # расширение (event_ deeplink)
└── handlers/help.ts
```

### Интеграция

```
Mini App открыт в Telegram → initData → telegram-miniapp.post → User + session
useTelegram() → MainButton/BackButton/theme/haptics на страницах 4-6
NotifierService ← вызовы из booking/payment/event сервисов (после коммита)
```

## Эпики

| ID                                   | Эпик                                                      | Задач | Часов | Сессия   |
| ------------------------------------ | --------------------------------------------------------- | ----: | ----: | -------- |
| 8.1                                  | Telegram WebApp auth (initData, User, session)            |     3 |   5-7 | 1        |
| 8.2                                  | Telegram WebApp SDK (MainButton/BackButton/theme/haptics) |     3 |   5-7 | 1        |
| 8.3                                  | Bot команды + deeplinks (org_, event_)                    |     2 |   3-4 | 1        |
| 8.4                                  | NotifierService (поверх grammY)                           |     2 |   3-4 | 2        |
| 8.5                                  | Уведомления (booking/payment/promotion/cancel)            |     4 |   6-8 | 2        |
| 8.6                                  | UX полировка (loading/error/offline)                      |     2 |   3-4 | 2        |
| 8.7                                  | Tests + manual QA                                         |     2 |   3-4 | 2        |
| [8.8](../epics/8-8-review-fixes.md)  | **Исправления по ревью v0.1.0**                           |    12 | 24-32 | 3.9, 6.8 |
| [8.9](../epics/8-9-review2-fixes.md) | **Исправления по повторному ревью v0.1.1**                |     1 |     1 | 8.8      |

**Итого:** 7 эпиков, ~18 задач, 50-70 часов.

## Технические заметки

### Утверждённые решения

1. **Phase 8 = тонкий Telegram-слой** поверх готовых страниц 4-6 (не переписываем)
2. **WebApp нативные элементы прогрессивно:** MainButton для ключевых действий, BackButton везде, theme, haptics
3. **Auth:** initData основной путь + email fallback (браузер)
4. **Авто-создание User** из Telegram-данных (имя, username, telegram_id), email опционально позже
5. **NotifierService** — абстракция поверх grammY (не tight coupling, не event-queue)
6. **Все отложенные уведомления:** booking confirmed, promotion, payment confirmed/rejected, event cancelled, pending payment организатору
7. **Fire-and-forget после коммита** (не в транзакции; очередь с retry — Phase 15)
8. **Команды:** /start (deeplink), /help (минимум; Mini App — основная работа)
9. **event\_ deeplink:** да (поделиться событием)
10. **Long-polling** в Phase 8, webhook — Phase 9 (deploy)
11. **Разбивка:** Сессия 1 foundation (8.1-8.3), Сессия 2 notifier+уведомления+полировка+tests (8.4-8.7)

### Что НЕ делаем в Phase 8

- ❌ Не переписываем страницы 4-6 (только Telegram-обёртка)
- ❌ Reminders за 24ч/2ч до события — Phase 15 (scheduler)
- ❌ Очередь уведомлений с retry — Phase 15
- ❌ Webhook режим — Phase 9 (deploy)
- ❌ Push вне Telegram (email/SMS) — Phase 15
- ❌ Inline-режим бота, кнопки в чате группы — после MVP
- ❌ Event credits — Phase 7

### Что переносим из Level Volley

- Pattern «нажми и сразу что-то происходит» (MainButton, без длинных FSM)
- Inline-editing с автосохранением (✓ ⏳ ✗ индикаторы) — уже в 5.10.3 attendance
- Compact mobile-first UI

## Ссылки

- [3-5-1-grammy-init.md](../tasks/3-5-1-grammy-init.md), [3-3-3-telegram-identity.md](../tasks/3-3-3-telegram-identity.md)
- [4-4-4-telegram-deeplink-handler.md](../tasks/4-4-4-telegram-deeplink-handler.md)
- [STACK_DECISIONS.md](../architecture/STACK_DECISIONS.md) — grammY выбор
