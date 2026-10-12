---
id: '19.2.2'
phase: '19'
epic: '19.2'
status: todo
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-12
status_note: ''
ref_id: 'P-02'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-opus-5-5
review_gate: opus
roles: [BACK, DB]
depends_on: ['19.2.1']
supersedes: []
decisions: ['D-02']
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/01-platform/P-02-group-settings.md'
  screens: ['4-cabinet/19-screen.png']
tags: [reference-v3]
---

# Task 19.2.2: Настройки группы v3 (`P-02`)

## Цель

Настройки уровня группы, которые задают поведение событий по умолчанию.

## Контекст

- Спецификация референса: [P-02 · Настройки группы](../design/reference-v3/specs/01-platform/P-02-group-settings.md); макет: 4 Кабинет организатора → Настройки → Записи и оплата.
- **Как есть (main `e68acf2`):** `organizations.subscriptionsEnabled` (5.13.21), часовой пояс и валюта; срок отмены задаётся у каждого события (`events.cancellationDeadlineHours`).
- **Дельта до референса:** Добавить `maxSeats` (1–10, по умолчанию 3), `defaultPriceMode`, `defaultJoinMode`, политику отмены на уровне группы, `seoIndex`, город/район; история изменений настроек; снимок значений в событие при создании.
- Решения владельца (2026-10-12): [D-02](../operations/decisions/2026-10-12-reference-v3-decisions.md#d-02) — политику отмены задаёт группа; событие при создании хранит снимок, существующие события сохраняют свои значения.
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-opus-5-5` (ревью Opus); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Настройки группы** — Кабинет задаёт поведение Mini App. С этим связаны: [W-11 → 20.5.7](20-5-7-settings.md), [W-09 → 21.2.6](21-2-6-subscriptions.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-06 → 20.4.5](20-4-5-event-booking.md), [M-09 → 20.4.8](20-4-8-cancel-booking.md), [W-04 → 20.5.5](20-5-5-event-create.md). [Подробнее](../design/reference-v3/specs/links.md#settings)
- **Абонементы** — Выключатель в кабинете скрывает вкладку и продажу в Mini App. С этим связаны: [W-09 → 21.2.6](21-2-6-subscriptions.md), [M-02 → 20.4.2](20-4-2-tab-bar.md), [M-13 → 20.4.9](20-4-9-player-screens.md), [P-03 → 20.1.1](20-1-1-pricing.md). [Подробнее](../design/reference-v3/specs/links.md#subs)
- **Страница группы** — Конструктор организатора, рендер и модерация root. С этим связаны: [W-13 → 24.1.1](24-1-1-group-page-builder.md), [W-14 → 24.1.2](24-1-2-group-page-render.md), [R-06 → 24.1.3](24-1-3-group-page-moderation.md). [Подробнее](../design/reference-v3/specs/links.md#seo)

## Что должно быть сделано

1. `subsOn` — абонементы в группе включены/выключены
2. `maxSeats` — мест на одного игрока, по умолчанию 3, диапазон 1–10
3. `priceMode` по умолчанию: фиксированная цена или сбор суммой
4. `joinMode` по умолчанию: свободная запись или по приглашению
5. Политика отмены: разрешена ли, за сколько часов до начала закрывается; редактируется только в группе, событие хранит снимок (D-02)
6. `seoIndex`, город, район
7. Данные и API: GET/PATCH /groups/{id}/settings; История изменений настроек (кто, когда, было/стало).
8. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Изменение настройки не меняет уже созданные события
- ✅ Новое событие получает значения группы по умолчанию
- ✅ Выключение абонементов скрывает их в Mini App и запрещает продажу новых
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-opus-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/19-screen.png](../design/reference-v3/screenshots/4-cabinet/19-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
