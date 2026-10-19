---
id: '20.3.3'
phase: '20'
epic: '20.3'
status: in_progress
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-19
status_note: 'Реализовано, PR открыт, ревью ожидается: /start (+ event_<id>_<токен>), /games, /my, /menu с reply-клавиатурой, inline-кнопки «Не смогу» (с подтверждением) и «Беру место» через answerCallbackQuery + editMessageText, снятие users.bot_blocked_at по /start и my_chat_member через внутренний API web (миграции нет). Не вошло (решения владельца, см. примечания): «Буду», «Пропущу», «Мой абонемент», «Сборы»; контракт анонса в чат группы для 20.5.8 не определён. Визуальная сверка — docs/operations/qa/2026-10-19-20-3-3-bot-v3-visual.md; проверка на устройстве и production-подключение — владелец.'
ref_id: 'P-16'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [BACK]
depends_on: ['20.1.3', '20.3.2']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-16-telegram-bot.md'
  screens: ['2-bot']
tags: [reference-v3]
---

# Task 20.3.3: Telegram-бот v3 (`P-16`)

## Цель

Бот как вход в Mini App и канал уведомлений.

## Контекст

- Спецификация референса: [P-16 · Telegram-бот](../design/reference-v3/specs/01-platform/P-16-telegram-bot.md); макет: 2 Telegram Bot.
- **Как есть (main `e68acf2`):** grammY: `/start` с deeplink приглашения в организацию, `/help`, fallback; polling в production.
- **Дельта до референса:** Команды `/games`, `/my`, reply-клавиатура меню, inline-кнопки с `answerCallbackQuery` + `editMessageText`, deeplink на событие, только реальные возможности Bot API.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [W-11 → 20.5.7](20-5-7-settings.md), [W-04 → 20.5.5](20-5-5-event-create.md), [M-23 → 21.1.2](21-1-2-org-event-create.md), [M-08 → 20.4.7](20-4-7-invite-booking.md), [W-14 → 24.1.2](24-1-2-group-page-render.md). [Подробнее](../design/reference-v3/specs/links.md#invite)
- **Уведомления** — Бот, лента Mini App и лента кабинета — один источник. С этим связаны: [P-09 → 20.3.2](20-3-2-bot-notifications.md), [W-15 → 21.2.9](21-2-9-notifications.md), [M-13 → 20.4.9](20-4-9-player-screens.md), [M-17 → 25.1.2](25-1-2-self-check.md). [Подробнее](../design/reference-v3/specs/links.md#notify)

## Что должно быть сделано

1. Команды /start, /games, /my
2. Inline-кнопки, deep links в Mini App (startapp)
3. Только реальные возможности Bot API
4. Данные и API: Webhook, обработчики.
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Ссылка-приглашение из бота открывает нужное событие
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Кнопки уведомлений бота из макета (перенесено из [20.3.2](20-3-2-bot-notifications.md), решение владельца 2026-10-19) входят в сверку этой карточки
- ✅ Отметка недоступного бота `users.bot_blocked_at` снимается входящими обновлениями: `/start` и `my_chat_member` (статус `member`); тест. Критичные уведомления отметке не подчиняются (одна попытка всегда)
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Примечания реализации

- **Бот без БД — внутренний API web.** `GET /api/internal/bot/games|my?telegramId=`, `POST /api/internal/bot/reachable|cancel-booking|accept-offer`; все под `x-internal-secret` (константное сравнение), проверка секрета раньше разбора тела, лимит 30 вызовов в минуту на Telegram id, тело валидируется (422). Логика — `botService` в `packages/core/src/bot`: любое действие выполняется над данными пользователя, найденного по Telegram id, и только если он действующий участник группы; id события из `callback_data` ничего не даёт без записи самого пользователя (IDOR-тесты). Повторы идемпотентны (`already_cancelled`, повторное принятие предложения → `accepted`).
- **Inline-кнопки.** `callback_data`: `cx:<id события>` (спросить подтверждение), `cy` (подтвердить отмену), `cn` (оставить), `oa` (принять предложение места), ≤ 14 байт. Бот проверяет формат, личный чат, что чат принадлежит нажавшему, и лимит 8 нажатий за 10 с; ответ — `answerCallbackQuery` (тост) и `editMessageText` с сохранением форматирования. Кнопки добавлены шаблонам 20.3.2: напоминания 24 ч / 2 ч — «Не смогу прийти» / «Не смогу», `waitlist_offer` — «Беру место»; транспорт уведомлений пропускает `callbackData` только из этих двух форматов. Отмена идёт через `bookingService.cancel` с теми же правилами (срок, политика группы, начавшееся событие).
- **Deeplink события.** Бот понимает `event_<id>` и `event_<id>_<токен>` (20.1.3) и передаёт параметр в `startapp` без изменений; формат совпадает с `resolveStartParam` Mini App.
- **Недоступный бот.** `/start` и `my_chat_member` со статусом `member` в личном чате вызывают `POST /api/internal/bot/reachable` — снимается `users.bot_blocked_at`. Критичные уведомления отметке не подчиняются (20.3.2, без изменений). Бот явно запрашивает `allowed_updates: message, callback_query, my_chat_member`.
- **Не вошло / решения.** «Буду», «Пропущу», «Мой абонемент», «Сборы», «Кто уже играет» из макета не реализованы — нет доменных функций (см. QA-заметку). **Контракт анонса в чат группы для [20.5.8](20-5-8-events-payments-row-menu.md) этой карточкой не определён:** в схеме нет привязки Telegram-чата к группе, а в карточке нет требования; существующий `/internal/notify` умеет слать сообщение по любому `telegramId` (в том числе id чата), но кнопки `web_app` в группах не работают (нужны `url`-ссылки `t.me/<бот>?startapp=…`). Карточку 20.5.8 нужно остановить до решения владельца о привязке чата (миграция, `my_chat_member` в группе, права администратора бота) и дополнить этой карточкой.
- **Production-подключение (владелец, предлагается в 20.7.1):** выкладка бота; `setMyCommands` выполняется ботом при старте (добавлены `/games`, `/my`); при webhook `allowed_updates` задаётся при регистрации; новых переменных окружения нет (используются `BOT_INTERNAL_SECRET`, `WEB_URL`).

## Подсказки

- Скриншоты: [2-bot](../design/reference-v3/screenshots/2-bot) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-bot.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
