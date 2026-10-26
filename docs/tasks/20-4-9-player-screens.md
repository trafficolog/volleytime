---
id: '20.4.9'
phase: '20'
epic: '20.4'
status: done
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-26
status_note: 'PR #166 смёржен (ревью Sonnet — merge, CI green на 6975ec2), закрытие — PR #182. Абонементы и покупка, мои записи, лента и колокольчик уведомлений, профиль; сверка — docs/operations/qa/2026-10-19-20-4-9-player-screens-visual.md (Critical/Important нет). «Сборы» — 21.1.6; остальное не вошедшее — в разделе «Follow-up».'
ref_id: 'M-13'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['19.1.1', '20.3.2']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-13-player-screens.md'
  screens:
    [
      '3-miniapp-player/04-screen.png',
      '3-miniapp-player/05-screen.png',
      '3-miniapp-player/06-screen.png',
      '3-miniapp-player/11-screen.png',
      '3-miniapp-player/12-screen.png',
    ]
tags: [reference-v3]
---

# Task 20.4.9: Экраны игрока v3: абонементы, мои записи, уведомления, профиль (`M-13`)

## Цель

Перенести существующие экраны в редизайн Bento Bold.

## Контекст

- Спецификация референса: [M-13 · Остальные экраны игрока](../design/reference-v3/specs/02-mini-app/M-13-player-screens.md); макет: 3 Mini App → Абонементы, Сборы, Мои записи, Уведомления.
- **Как есть (main `e68acf2`):** Абонементы, покупка, мои записи, профиль в стиле v2 (8.10.1).
- **Дельта до референса:** Перенос в v3 и новая лента уведомлений из 20.3.2. «Сборы» игрока вынесены в 21.1.6, потому что домен сборов появляется в 21.2.4.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Абонементы** — Выключатель в кабинете скрывает вкладку и продажу в Mini App. С этим связаны: [W-09 → 21.2.6](21-2-6-subscriptions.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [P-02 → 19.2.2](19-2-2-group-settings.md), [P-03 → 20.1.1](20-1-1-pricing.md). [Подробнее](../design/reference-v3/specs/links.md#subs)
- **Уведомления** — Бот, лента Mini App и лента кабинета — один источник. С этим связаны: [P-09 → 20.3.2](20-3-2-bot-notifications.md), [P-16 → 20.3.3](20-3-3-telegram-bot.md), [W-15 → 21.2.9](21-2-9-notifications.md), [M-17 → 25.1.2](25-1-2-self-check.md). [Подробнее](../design/reference-v3/specs/links.md#notify)

## Что должно быть сделано

1. Абонементы
2. ~~Сборы~~ — перенесено в [21.1.6](21-1-6-player-collections.md) (домен сборов появляется в 21.2.4)
3. Мои записи
4. Уведомления
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Совпадение с макетом по токенам
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Лента и колокольчик уведомлений (перенесено из [20.3.2](20-3-2-bot-notifications.md), решение владельца 2026-10-19): `GET /api/notifications`, `POST /api/notifications/read`, `unreadCount`; отчёт сверки охватывает экран «Уведомления»
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Follow-up (бэклог, не блокирует закрытие)

- **«Сборы» игрока** — [21.1.6](21-1-6-player-collections.md) (домен сборов появляется в 21.2.4).
- **Позиция в листе ожидания** — [20.4.11](20-4-11-waitlist-position.md) (сделано там).
- **v0.3.0 (backlog [RELEASES](../RELEASES.md), решения владельца 2026-10-20):** кнопка «Оплатить» в «Мои записи» вместе с реквизитами организатора на экране покупки; статистика профиля (посещения, посещаемость, no-show); строки «Язык», «Выйти», «Изменить», «Напоминания».
- **Backlog без даты (нужна модель данных):** номер абонемента `#SUB`, «поделиться абонементом», чип «Популярный»; кнопки действий на карточках ленты («Подтверждаю / Не смогу» и т. п.), счётчики на сегментах «Мои записи».
- **Принято:** ссылка «Создать группу» на текущее одношаговое создание допустима до [21.1.7](21-1-7-group-creation-wizard.md).
- **Не снято в сверке (покрыто интеракционными тестами):** пустая лента, ошибка загрузки, догрузка страницы, раздел «В листе ожидания», абонементы выключены; Chromium only, safe-area и reduced motion не проверялись — на устройстве, в Telegram QA релиза [20.7.1](20-7-1-release-v0-2-0-qa.md) (п. 13).

## Примечания реализации

- **Маршруты:** `/m/orgs/:id/subscriptions` (остаток, история, списания), `/m/orgs/:id/subscriptions/buy` (выбор плана и способа оплаты; прежний лист покупки заменён экраном), `/m/orgs/:id/notifications` (лента группы), `/m/orgs/:id/bookings` и `/profile` — в стиле v3. Колокольчик со счётчиком `unreadCount` — в шапке главной игрока (перенесён из [20.4.4](20-4-4-player-home-v3.md)); лента и колокольчик ограничены текущей группой (`organizationId`).
- **Без новых API и миграций:** использованы `GET /api/notifications`, `POST /api/notifications/read` (20.3.2) и прежние эндпоинты абонементов и записей.
- **Не вошло.** «Сборы» — [21.1.6](21-1-6-player-collections.md); позиция в листе ожидания — [20.4.11](20-4-11-waitlist-position.md); действия-кнопки на карточках уведомлений. Решения владельца 2026-10-20 ([журнал](../operations/decisions/2026-10-12-reference-v3-decisions.md)): кнопка «Оплатить» в «Мои записи» вместе с реквизитами организатора на экране покупки, статистика профиля (посещения, посещаемость, no-show) и строки «Язык», «Выйти», «Изменить» — в v0.3.0 (backlog [RELEASES](../RELEASES.md)); номер абонемента `#SUB`, «поделиться» и чип «Популярный» — в backlog без даты (нужна модель данных); ссылка «Создать группу» на текущее одношаговое создание допустима до [21.1.7](21-1-7-group-creation-wizard.md). Подробности — в отчёте сверки.

## Подсказки

- Скриншоты: [3-miniapp-player/04-screen.png](../design/reference-v3/screenshots/3-miniapp-player/04-screen.png), [3-miniapp-player/05-screen.png](../design/reference-v3/screenshots/3-miniapp-player/05-screen.png), [3-miniapp-player/06-screen.png](../design/reference-v3/screenshots/3-miniapp-player/06-screen.png), [3-miniapp-player/11-screen.png](../design/reference-v3/screenshots/3-miniapp-player/11-screen.png), [3-miniapp-player/12-screen.png](../design/reference-v3/screenshots/3-miniapp-player/12-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
