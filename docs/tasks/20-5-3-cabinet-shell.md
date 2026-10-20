---
id: '20.5.3'
phase: '20'
epic: '20.5'
status: done
release: 'v0.2.0'
sync_state: synced
last_reviewed: 2026-10-20
status_note: 'Реализовано в PR #171 (оболочка), доработки ревью и решений владельца 2026-10-20 — в закрывающем PR (trafficolog/fix/20.5.3-close): колокольчик скрыт до 21.2.9, «Оплаты» убраны из сайдбара, a11y-правки. Пункты Сборы/Отчёты/Баланс и «Пополнить» — в 21.2.5/21.2.7/21.2.8.'
ref_id: 'W-01'
complexity: M
impl_model: claude-sonnet-5-5
review_model: claude-sonnet-5-5
review_gate: standard
roles: [FE]
depends_on: ['20.5.2', '19.1.1', '20.2.1']
supersedes: []
decisions: []
estimated_hours: '4-8'
reference:
  spec: 'docs/design/reference-v3/specs/03-organizer-web/W-01-cabinet-shell.md'
  screens: ['4-cabinet/01-screen.png']
tags: [reference-v3]
---

# Task 20.5.3: Оболочка кабинета v3 (`W-01`)

## Цель

Каркас кабинета.

## Контекст

- Спецификация референса: [W-01 · Оболочка кабинета](../design/reference-v3/specs/03-organizer-web/W-01-cabinet-shell.md); макет: 4 Кабинет организатора.
- **Как есть (main `e68acf2`):** Layout `desktop-org` с сайдбаром (5.15.1).
- **Дельта до референса:** Сайдбар 240px с разделами v3, топбар без переноса заголовка, поиск за иконкой (⌘K, Esc, клик вне), колокольчик, плашка «Баланс событий».
- Модель: реализация `claude-sonnet-5-5`, ревью `claude-sonnet-5-5` (независимое ревью); маршрутизация — [ORCHESTRATION](../ORCHESTRATION.md).

**Общий функционал с другими интерфейсами:**

- **Баланс событий** — Списания организатора и начисления админа — один журнал. С этим связаны: [P-08 → 20.2.1](20-2-1-event-balance.md), [W-12 → 21.2.8](21-2-8-balance-billing.md), [P-06 → 20.2.2](20-2-2-event-series.md), [W-05 → 20.5.6](20-5-6-event-card.md), [R-02 → 22.2.1](22-2-1-balance-tariffs.md), [R-03 → 22.2.2](22-2-2-grant-balance.md), [R-04 → 22.2.3](22-2-3-subscriptions-payouts.md), [R-08 → 19.1.4](19-1-4-rename-credits.md). [Подробнее](../design/reference-v3/specs/links.md#balance)
- **Поиск** — Поиск топбара кабинета. С этим связаны: [P-13 → 20.5.2](20-5-2-cabinet-search.md). [Подробнее](../design/reference-v3/specs/links.md#search)

## Что должно быть сделано

1. Сайдбар с разделами
2. Топбар
3. Поиск за иконкой: выезжает, закрывается крестиком, Esc, кликом вне
4. Плашка «Баланс событий» в сайдбаре
5. Сверить экраны с референсом через харнесс [19.0.2](19-0-2-visual-reference-harness.md) и приложить отчёт к PR.

## Критерии приёмки

- ✅ Поиск доступен с клавиатуры
- ✅ Отчёт визуальной сверки по экранам из `reference.screens` без открытых расхождений Critical/Important
- ✅ Пять gates CODING_STANDARDS на tested revision; ревью `claude-sonnet-5-5` без Critical/Important

## Подсказки

- Скриншоты: [4-cabinet/01-screen.png](../design/reference-v3/screenshots/4-cabinet/01-screen.png) (окно 924×540 — ориентир; размеры и отступы брать из исходников).
- Исходники макета: `docs/design/reference-v3/handoff/screens-web.jsx`, `docs/design/reference-v3/handoff/screens-web-forms.jsx`; токены — `handoff/styles.css`; доменные функции — `handoff/atoms.jsx`.
- Handoff: [README](../design/reference-v3/handoff/README.md) — статусная модель, доменная логика, доступность.

## Не делать

- ❌ Не переносить React/Babel прототипа и моковые данные; только Vue-компоненты, токены проекта и реальные API
- ❌ Не расширять scope за пределы карточки: соседние экраны и гипотезы принадлежат своим задачам
