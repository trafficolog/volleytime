---
id: '20.3.3'
phase: '20'
epic: '20.3'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
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

## Подсказки

- Скриншоты: [2-bot](../design/reference-v3/screenshots/2-bot) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-bot.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
