---
id: '20.4.9'
phase: '20'
epic: '20.4'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
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
2. Сборы
3. Мои записи
4. Уведомления
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Совпадение с макетом по токенам
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Лента и колокольчик уведомлений (перенесено из [20.3.2](20-3-2-bot-notifications.md), решение владельца 2026-10-19): `GET /api/notifications`, `POST /api/notifications/read`, `unreadCount`; отчёт сверки охватывает экран «Уведомления»
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-player/04-screen.png](../design/reference-v3/screenshots/3-miniapp-player/04-screen.png), [3-miniapp-player/05-screen.png](../design/reference-v3/screenshots/3-miniapp-player/05-screen.png), [3-miniapp-player/06-screen.png](../design/reference-v3/screenshots/3-miniapp-player/06-screen.png), [3-miniapp-player/11-screen.png](../design/reference-v3/screenshots/3-miniapp-player/11-screen.png), [3-miniapp-player/12-screen.png](../design/reference-v3/screenshots/3-miniapp-player/12-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-player.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`, `docs/design/reference-v3/handoff/atoms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
