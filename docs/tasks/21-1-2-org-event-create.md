---
id: '21.1.2'
phase: '21'
epic: '21.1'
status: todo
release: 'v0.3.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'M-23'
complexity: L
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [FE]
depends_on: ['20.1.1', '20.2.2', '20.1.3', '20.5.5']
supersedes: []
decisions: []
estimated_hours: '8-16'
reference:
  spec: 'docs/design/reference-v3/specs/02-mini-app/M-23-org-event-create.md'
  screens: ['3-miniapp-organizer/05-screen.png']
tags: [reference-v3]
---

# Task 21.1.2: Mini App организатора: создание события и серии (`M-23`)

## Цель

Создание события с телефона по тем же правилам, что в кабинете.

## Контекст

- Спецификация референса: [M-23 · Организатор · создание события](../design/reference-v3/specs/02-mini-app/M-23-org-event-create.md); макет: 3 Mini App → режим организатора.
- **Как есть (main `e68acf2`):** Создание одного события с fixed/split (5.16.2).
- **Дельта до референса:** Тот же контракт API, что 20.5.5: места на игрока, режим записи, серия.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).
- **Перенесено из 20.2.2 ([решение владельца 2026-10-15, D-04 (A)](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-04)):** визуальная сверка серии в Mini App (повтор, предпросмотр, число публикуемых и черновиков) по `3-miniapp-organizer/05-screen.png`; контракт серий — тот же, что у 20.5.5. Текст интерфейса «N раз»: число повторений считается **до** исключений, исключённая дата уменьшает число событий (D-04 (D)); предпросмотр показывает итог. `POST …/series` требует `idempotencyKey` (8–64 символа `[A-Za-z0-9_-]`): клиент создаёт ключ один раз на попытку создания и повторяет его при повторе запроса; без ключа — 422.

**Общий функционал с другими интерфейсами:**

- **Создание события** — Одна форма и один контракт API в кабинете и в Mini App организатора. С этим связаны: [W-04 → 20.5.5](20-5-5-event-create.md), [W-02 → 21.2.1](21-2-1-overview.md), [P-03 → 20.1.1](20-1-1-pricing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [P-08 → 20.2.1](20-2-1-event-balance.md), [M-16 → 25.1.1](25-1-1-warmup.md). [Подробнее](../design/reference-v3/specs/links.md#create-event)
- **Режим записи и приглашения** — Настройка группы по умолчанию → событие → Mini App и бот. С этим связаны: [P-07 → 20.1.3](20-1-3-join-mode-invites.md), [W-11 → 20.5.7](20-5-7-settings.md), [W-04 → 20.5.5](20-5-5-event-create.md), [M-08 → 20.4.7](20-4-7-invite-booking.md), [P-16 → 20.3.3](20-3-3-telegram-bot.md), [W-14 → 24.1.2](24-1-2-group-page-render.md). [Подробнее](../design/reference-v3/specs/links.md#invite)
- **Разминка в событии** — Организатор включает разминку в событие, игрок видит и пропускает её. С этим связаны: [W-04 → 20.5.5](20-5-5-event-create.md), [M-16 → 25.1.1](25-1-1-warmup.md), [M-03 → 23.2.1](23-2-1-home-feed.md). [Подробнее](../design/reference-v3/specs/links.md#warmup)

- **Решение владельца 2026-10-15 (ревью 20.4.1):** MainButton через `createMainButton` ([20.4.1](20-4-1-telegram-shell.md)), кнопка формы скрыта только в Telegram.

## Что должно быть сделано

1. Тип оплаты
2. Места и мест на игрока
3. Режим записи с наследованием
4. Разминка в составе
5. Серия
6. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Тот же контракт API, что у W-04
- ✅ Визуальная сверка включает серию по `3-miniapp-organizer/05-screen.png` (перенесено из 20.2.2)
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [3-miniapp-organizer/05-screen.png](../design/reference-v3/screenshots/3-miniapp-organizer/05-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-organizer.jsx`, `docs/design/reference-v3/handoff/screens-contributions.jsx`, `docs/design/reference-v3/handoff/app-nav.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Разминку в составе добавляет 25.1.1
- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
